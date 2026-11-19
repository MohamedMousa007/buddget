/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads the untyped persisted store and PostgREST JSON */
import { expect, goto, localWait, test } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { blur, dialog } from '../lib/ui'

test('S1 every user has one real, untracked Cash; tracking it shows it as an estimate (docs/SYSTEM_CASH_PLAN.md)', async ({ page, user }) => {
  const cash = await test.step('a new account gets its Cash after the first pull, untracked, and on the server', async () => {
    const c = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'cash' && m.id !== 'pm_default_cash' && !m.closedAt))
    expect(c.openingBalance ?? null).toBeNull()
    await serverRows('payment_methods', user.id, `id=eq.${c.id}`, (r: any[]) => r.length === 1 && r[0].opening_balance === null)
    return c
  })
  await test.step('Cash waits on the Accounts page, even before any account exists', async () => {
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: 'Add one myself' })).toBeVisible()
    await expect(page.getByText('Add a balance to include it')).toBeVisible()
  })
  await test.step('the first cash expense asks once how much cash there is; the answer starts an estimate', async () => {
    await goto(page, '/flow')
    await page.getByRole('button', { name: 'Quick add' }).first().click()
    await dialog(page, 'Add').getByRole('button', { name: /^Expense/ }).click()
    const d = dialog(page, 'Add expense')
    await d.getByRole('textbox', { name: 'Amount' }).fill('50')
    await d.getByRole('textbox', { name: 'Description' }).fill('QA S1 taxi')
    await d.getByRole('radio', { name: 'Transport', exact: true }).click()
    await blur(page)
    await d.getByRole('button', { name: 'Save expense' }).click()
    const ask = dialog(page, 'How much cash do you have right now?')
    await expect(ask).toBeVisible()
    await ask.getByRole('textbox', { name: 'Amount' }).fill('800')
    await blur(page)
    await ask.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(ask).toBeHidden()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === cash.id && m.openingBalance === 800))
    await serverRows('payment_methods', user.id, `id=eq.${cash.id}`, (r: any[]) => Number(r[0]?.opening_balance) === 800)
  })
  await test.step('never asked again', async () => {
    await page.getByRole('button', { name: 'Quick add' }).first().click()
    await dialog(page, 'Add').getByRole('button', { name: /^Expense/ }).click()
    const d = dialog(page, 'Add expense')
    await d.getByRole('textbox', { name: 'Amount' }).fill('20')
    await d.getByRole('textbox', { name: 'Description' }).fill('QA S1 tea')
    await d.getByRole('radio', { name: 'Food', exact: true }).click()
    await blur(page)
    await d.getByRole('button', { name: 'Save expense' }).click()
    await expect(d).toBeHidden()
    await page.waitForTimeout(1200)
    await expect(dialog(page, 'How much cash do you have right now?')).toBeHidden()
  })
  await test.step('Cash is now an account row, labelled an estimate', async () => {
    await goto(page, '/accounts')
    const row = page.getByRole('button', { name: 'Cash', exact: true })
    await expect(row).toContainText('Estimate')
    const real = await localWait(page, (s) => s.paymentMethods.filter((m: any) => m.type === 'cash' && m.id !== 'pm_default_cash' && !m.closedAt))
    expect(real).toHaveLength(1)
    await row.click()
    await expect(page.getByText('An estimate from what you log.', { exact: false })).toBeVisible()
  })
})
