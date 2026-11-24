/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// Round 3, PR #38 money tickets. BUD-100/90: net worth = pockets + investments + tracked accounts - debts, a closed account
// leaves it, the daily snapshot is stamped `assets` when no account is tracked. BUD-39/99: money someone repays you is
// received money: it credits the account, Flow marks it "Not income", Money in leaves it out. BUD-103: a cleared non-card
// debt owes 0. BUD-87: add-money to a goal says what is left or over. Card carousel details follow the selected card.
// Default payment method: explicit choice, else Cash; the Cash row's menu sets it as default.
import type { Page } from '@playwright/test'
import { expect, goto, localState, localWait, money, test, tile } from '../../lib/fixtures'
import { serverRows } from '../../lib/server'
import { addExpense, blur, dialog } from '../../lib/ui'
import { bank, localMethod, seed } from './seed'

async function openAccount(page: Page, name: RegExp) {
  await goto(page, '/accounts')
  await page.getByRole('button', { name }).first().click()
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Update' }) }).last()
}
/** The hero's net worth: its value and the "Net worth" label share one paragraph. */
async function netWorth(page: Page): Promise<number> {
  return money(await page.locator('main p').filter({ hasText: /Net worth\s*$/ }).first().textContent())
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

test('W1 net worth = tracked accounts - debts; closing an account takes it out [BUD-100, BUD-90]', async ({ page, user }) => {
  await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 5000)])
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 2000)])
  await seed(page, user.id, 'debts', [{ name: 'QA W1 loan', person: 'Sara', amount: 1000, remaining_amount: 1000, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'active' }])
  await localMethod(page, cib.id)

  await goto(page, '/accounts')
  await expect.poll(() => netWorth(page)).toBe(6000)

  await test.step('close CIB: it leaves the list and net worth', async () => {
    const d = await openAccount(page, /^CIB/)
    await d.getByRole('button', { name: 'More actions' }).first().click()
    await page.getByRole('menuitem', { name: 'Close account' }).click()
    const ask = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: 'Close account' })).last()
    await expect(ask).toContainText('leave your lists, totals and net worth')
    // The confirm button reads "Delete" although the account is only closed (history stays): reported in R3-coverage.
    await ask.getByRole('button', { name: 'Delete', exact: true }).click()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === cib.id && m.closedAt))
    await serverRows('payment_methods', user.id, `id=eq.${cib.id}`, (r: any[]) => !!r[0]?.closed_at)
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /^CIB/ })).toHaveCount(0)
    await expect.poll(() => netWorth(page)).toBe(4000)
    await goto(page, '/wealth')
    await expect.poll(() => netWorth(page)).toBe(4000)
  })
})

test('W2 with no tracked account the daily snapshot is stamped with the assets basis [BUD-90]', async ({ page, user }) => {
  await seed(page, user.id, 'debts', [{ name: 'QA W2 loan', person: 'Ali', amount: 300, remaining_amount: 300, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'active' }])
  await localWait(page, (s) => s.debts.find((d: any) => d.name === 'QA W2 loan'))
  // The snapshot is written once a day per device; forget today's mark so this page load writes it with the seeded debt.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('bdg-nw-day:')) localStorage.removeItem(k) })
  await goto(page, '/wealth')
  await expect.poll(() => netWorth(page)).toBe(-300)
  await serverRows('net_worth_snapshots', user.id, `day=eq.${today()}`, (r: any[]) => r[0]?.basis === 'assets' && Number(r[0]?.net_worth) === -300, 45_000)
})

test('W3 a repayment someone makes you credits the account, Flow marks it Not income, Money in leaves it out [BUD-39, BUD-99]', async ({ page, user }) => {
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 5000)])
  const [debt] = await seed(page, user.id, 'debts', [{ name: 'QA W3 lend', person: 'Omar', amount: 600, remaining_amount: 600, currency: 'EGP', debt_type: 'personal', direction: 'they_owe', status: 'active' }])
  await localMethod(page, qnb.id)
  await goto(page, '/flow')
  const moneyIn = await tile(page, 'Money in')
  expect(moneyIn).toBe(0)

  await test.step('Log receipt for the QA W3 lend: 200 into QNB', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: 'Log receipt from QA W3 lend' }).click()
    const d = dialog(page, 'Record money received')
    await expect(d).toContainText('Owed to you')
    await d.getByRole('textbox', { name: 'Amount' }).fill('200')
    await d.getByRole('button', { name: 'QNB Alahli', exact: true }).first().click()
    await blur(page)
    await d.getByRole('button', { name: /^Receive 200 EGP$/ }).click()
    await expect(d).toBeHidden()
  })

  await test.step('one debt payment row, no income event, no expense', async () => {
    await serverRows('debt_payments', user.id, `debt_id=eq.${debt.id}`, (r: any[]) => r.length === 1 && Number(r[0].amount) === 200 && r[0].payment_method_id === qnb.id)
    expect(await serverRows('income_events', user.id, 'select=id', () => true)).toHaveLength(0)
    expect(await serverRows('expenses', user.id, 'select=id&deleted_at=is.null', () => true)).toHaveLength(0)
  })

  await test.step('QNB is 200 higher; Flow shows the repayment as Not income; Money in unchanged', async () => {
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText('5,200.00')
    await goto(page, '/flow')
    const main = page.locator('main')
    await expect(main.getByText('Repaid by Omar').first()).toBeVisible()
    await expect(main.getByText('Not income').first()).toBeVisible()
    expect(await tile(page, 'Money in')).toBe(moneyIn)
  })
})

test('W4 a cleared non-card debt owes nothing even with an amount left on it [BUD-103]', async ({ page, user }) => {
  await seed(page, user.id, 'debts', [
    { name: 'QA W4 open', person: 'Nour', amount: 1000, remaining_amount: 1000, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'active', cleared_at: null },
    { name: 'QA W4 cleared', person: 'Hany', amount: 500, remaining_amount: 500, currency: 'EGP', debt_type: 'personal', direction: 'i_owe', status: 'cleared', cleared_at: new Date().toISOString() },
  ])
  await localWait(page, (s) => s.debts.filter((d: any) => d.name.startsWith('QA W4')).length === 2)
  await goto(page, '/debts')
  await expect.poll(() => tile(page, 'Still owed')).toBe(1000)
  await goto(page, '/wealth')
  await expect.poll(() => netWorth(page)).toBe(-1000)
})

test('W5 add money to a goal says what is left or over the target and never caps it [BUD-87]', async ({ page, user }) => {
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 3000)])
  await localMethod(page, qnb.id)
  await goto(page, '/goals')
  await page.getByRole('button', { name: 'Start from scratch' }).click()
  const g = dialog(page, 'Add a goal')
  await g.getByRole('button', { name: 'Vacation' }).click()
  await g.getByRole('textbox', { name: 'Name' }).fill('QA W5 Trip')
  await g.getByRole('textbox', { name: 'Target Amount' }).fill('1000')
  await blur(page)
  await g.getByRole('button', { name: 'Next: fund it' }).click()
  await g.getByRole('radio', { name: /^I will add money myself/ }).click()
  await g.getByRole('button', { name: 'Start my goal' }).click()
  await expect(g).toBeHidden()
  const goal = await localWait(page, (s) => s.goals.find((x: any) => x.name === 'QA W5 Trip'))

  await page.getByRole('button', { name: /Add money/ }).first().click()
  const d = dialog(page, 'Add money to QA W5 Trip')
  const amount = d.getByRole('textbox', { name: 'Amount' })
  const hint = d.getByRole('status')
  await amount.fill('400')
  await expect(hint).toHaveText(/600 left to target/)
  await amount.fill('1000')
  await expect(hint).toHaveText('Reaches your target')
  await amount.fill('1500')
  await expect(hint).toHaveText(/\+.*500 over target/)
  await blur(page)
  await d.getByRole('button', { name: 'Add money', exact: true }).click()
  await expect(d).toBeHidden()
  const pocketId = goal.linkedSavingsAccountIds[0]
  await serverRows('savings_accounts', user.id, `id=eq.${pocketId}`, (r: any[]) => Number(r[0]?.current_balance) === 1500)
})

test('W6 the account card carousel details follow the selected card', async ({ page, user }) => {
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 4000)])
  await seed(page, user.id, 'payment_methods', [
    { name: 'QNB Alahli', type: 'debit_card', currency: 'EGP', color: '#1f6feb', parent_id: qnb.id, last4: '1111' },
    { name: 'QNB Alahli', type: 'debit_card', currency: 'EGP', color: '#1f6feb', parent_id: qnb.id, last4: '2222' },
  ])
  await localWait(page, (s) => s.paymentMethods.filter((m: any) => m.parentId === qnb.id).length === 2)
  const d = await openAccount(page, /QNB Alahli/)
  const carousel = d.getByRole('group').filter({ hasNot: page.getByRole('radio') }).first()
  const details = d.locator('[aria-live="polite"]').first()
  const first = (await details.textContent()) ?? ''
  expect(first).toMatch(/Debit card · •• (1111|2222)/)
  await expect(details).toContainText('Uses the QNB Alahli balance')
  await carousel.focus()
  await carousel.press('ArrowRight')
  const other = first.includes('1111') ? '2222' : '1111'
  await expect(details).toContainText(`•• ${other}`)
  await expect(d.getByText('Spent with QNB Alahli')).toBeVisible()
})

test('W7 default payment method: Cash until one is chosen, then the chosen account; the Cash row sets itself as default', async ({ page, user }) => {
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 4000)])
  await localMethod(page, qnb.id)
  const methodOf = async (description: string) => (await localWait(page, (s) => s.expenses.find((e: any) => e.description === description))).paymentMethodId as string
  const cashIds = async () => ((await localState(page)).paymentMethods as any[]).filter((m) => m.type === 'cash').map((m) => m.id)

  await goto(page, '/flow')
  await addExpense(page, { amount: 10, description: 'QA W7 one', category: 'Food' })
  expect(await cashIds()).toContain(await methodOf('QA W7 one'))

  await test.step('QNB set as default from its account menu: the next expense uses it', async () => {
    const d = await openAccount(page, /QNB Alahli/)
    await d.getByRole('button', { name: 'More actions' }).first().click()
    await page.getByRole('menuitem', { name: 'Set as default' }).click()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === qnb.id && m.isDefault))
    await serverRows('payment_methods', user.id, `id=eq.${qnb.id}`, (r: any[]) => r[0]?.is_default === true)
    await goto(page, '/flow')
    await addExpense(page, { amount: 11, description: 'QA W7 two', category: 'Food' })
    expect(await methodOf('QA W7 two')).toBe(qnb.id)
  })

  await test.step('the Cash row menu sets Cash as default again', async () => {
    await goto(page, '/accounts')
    const row = page.getByRole('button', { name: /^Cash/ }).first()
    await row.locator('xpath=..').getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Set as default' }).click()
    const cash = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'cash' && m.isDefault && m.id !== 'pm_default_cash'))
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === qnb.id && !m.isDefault))
    await goto(page, '/flow')
    await addExpense(page, { amount: 12, description: 'QA W7 three', category: 'Food' })
    expect(await methodOf('QA W7 three')).toBe(cash.id)
  })
})
