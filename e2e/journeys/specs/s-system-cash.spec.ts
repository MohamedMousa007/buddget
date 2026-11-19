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
  await test.step('an untracked Cash is not an account yet: Accounts still opens on its empty state', async () => {
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: 'Add one myself' })).toBeVisible()
  })
  await test.step('tracking Cash reuses that same row and labels the balance an estimate', async () => {
    await page.getByRole('button', { name: 'Add one myself' }).click()
    const d = dialog(page, 'Add an account')
    await d.getByRole('radio', { name: 'Cash', exact: true }).click()
    await d.getByRole('textbox', { name: 'Amount' }).fill('800')
    await blur(page)
    await d.getByRole('button', { name: 'Add account', exact: true }).click()
    await expect(d).toBeHidden()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === cash.id && m.openingBalance === 800))
    const real = await localWait(page, (s) => s.paymentMethods.filter((m: any) => m.type === 'cash' && m.id !== 'pm_default_cash' && !m.closedAt))
    expect(real).toHaveLength(1)
    const row = page.getByRole('button', { name: 'Cash', exact: true })
    await expect(row).toContainText('Estimate')
    await row.click()
    await expect(page.getByText('An estimate from what you log.', { exact: false })).toBeVisible()
  })
})
