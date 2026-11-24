/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// QA night bugs 14 and 15 (ebc9aa8d, b058352f, decisions D13 and D16 in docs/plans/QA_NIGHT_PLAN.md): Flow lists no
// own-account moves and has no "Not counted" chip; an account's Recent row opens the expense editor; Cash can change
// its currency and is asked again in the new one.
import type { Page } from '@playwright/test'
import { expect, goto, localWait, test } from '../lib/fixtures'
import { serverRows } from '../lib/server'
import { addAccount, addExpense, blur, dialog } from '../lib/ui'

async function openAccount(page: Page, name: RegExp | string) {
  await goto(page, '/accounts')
  await page.getByRole('button', typeof name === 'string' ? { name, exact: true } : { name }).first().click()
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Update' }) }).last()
}

test('K1 Flow hides own-account moves with no "Not counted" chip; the account Recent row opens the expense editor', async ({ page, user }) => {
  await addAccount(page, { kind: 'Bank', provider: /QNB Alahli/, balance: 5000 })
  const qnb = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === 5000))

  await test.step('cash out 500 from QNB (an own-account move) and spend 120 on QNB', async () => {
    const detail = await openAccount(page, /QNB Alahli/)
    await detail.getByRole('button', { name: 'Cash out' }).click()
    const move = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^Withdraw / }) }).last()
    await move.getByRole('textbox', { name: 'Amount' }).fill('500')
    await blur(page)
    await move.getByRole('button', { name: /^Withdraw / }).click()
    await expect(move).toBeHidden()
    const atm = await localWait(page, (s) => s.expenses.find((e: any) => e.paymentMethodId === qnb.id && e.category === 'ATM Cash Withdrawal' && e.amount === 500))
    await serverRows('expenses', user.id, `id=eq.${atm.id}`, (r: any[]) => r.length === 1)
    await goto(page, '/flow')
    await addExpense(page, { amount: 120, description: 'QA K1 coffee', category: 'Food', method: /QNB/ })
    await localWait(page, (s) => s.expenses.find((e: any) => e.description === 'QA K1 coffee' && e.paymentMethodId === qnb.id))
  })

  await test.step('Flow lists the coffee, not the move, and offers no Not counted chip', async () => {
    await goto(page, '/flow')
    const main = page.locator('main')
    await expect(main.getByText('QA K1 coffee').first()).toBeVisible()
    await expect(main.getByText('Cash out', { exact: true })).toHaveCount(0)
    await expect(main.getByText(/Not counted/)).toHaveCount(0)
    await expect(main.getByText(/Totals exclude/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /moves between your own accounts/ })).toHaveCount(0)
  })

  await test.step('the move stays reachable in the account sheet; its Recent coffee row opens the editor', async () => {
    const detail = await openAccount(page, /QNB Alahli/)
    const row = detail.getByRole('button', { name: /QA K1 coffee/ }).first()
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await expect(detail).toBeHidden()
    const editor = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Description' }) }).last()
    await expect(editor.getByRole('textbox', { name: 'Description' })).toHaveValue('QA K1 coffee')
  })
})

test('K2 Cash changes currency: with money in it, the amount is asked again in the new currency [QA bug 15, D16]', async ({ page, user }) => {
  const cash = await test.step('track Cash with 1,000 EGP', async () => {
    const c = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'cash' && m.id !== 'pm_default_cash' && !m.closedAt))
    await addAccount(page, { kind: 'Cash', balance: 1000 })
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === c.id && m.openingBalance === 1000))
    return c
  })

  await test.step('Change currency to USD, 20 USD on hand', async () => {
    const detail = await openAccount(page, 'Cash')
    await detail.getByRole('button', { name: 'More actions' }).first().click()
    await page.getByRole('menuitem', { name: 'Change currency' }).click()
    const sheet = page.getByRole('dialog').filter({ hasText: 'Cash currency' }).last()
    await sheet.getByRole('button', { name: /EGP/ }).first().click()
    await dialog(page, 'Currency').getByRole('button', { name: 'US Dollar USD' }).click()
    await expect(sheet).toContainText('How much cash do you have in USD?')
    const amount = sheet.getByRole('textbox').first()
    await expect(amount).not.toHaveValue('')
    await amount.fill('20')
    await blur(page)
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(sheet).toBeHidden()
  })

  await test.step('Cash is now 20 USD, on the device and on the server', async () => {
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === cash.id && m.currency === 'USD'))
    await serverRows('payment_methods', user.id, `id=eq.${cash.id}`, (r: any[]) => r[0]?.currency === 'USD')
    await goto(page, '/accounts')
    const row = page.getByRole('button', { name: 'Cash', exact: true })
    await expect(row).toContainText('20.00')
    await expect(row).toContainText(/USD|\$/)
  })
})
