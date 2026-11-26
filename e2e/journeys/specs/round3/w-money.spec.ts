/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// Round 3, PR #38 money tickets. BUD-100/90: net worth = pockets + investments + tracked accounts - debts, a closed account
// leaves it, the daily snapshot is stamped `assets` when no account is tracked. BUD-39/99: money someone repays you is
// received money: it credits the account, Flow marks it "Not income", Money in leaves it out. BUD-103: a cleared non-card
// debt owes 0. BUD-87: add-money to a goal says what is left or over. Card carousel details follow the selected card.
// Default payment method: explicit choice, else Cash; the Cash row's menu sets it as default.
// DR-6: lending from a tracked account moves it (principal leg on the debt), the repayment moves it back.
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, goto, localState, localWait, money, test, tile, moneyIn } from '../../lib/fixtures'
import { serverRows } from '../../lib/server'
import { addExpense, blur, chooseMethod, dialog, shown } from '../../lib/ui'
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
const EVIDENCE = resolve(__dirname, '../../../../docs/qa/round3/evidence')
const shot = async (target: Page | ReturnType<Page['locator']>, name: string) => {
  mkdirSync(EVIDENCE, { recursive: true })
  await target.screenshot({ path: `${EVIDENCE}/${name}.png` })
}
const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString()

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
    await expect(ask).toContainText("You can't reopen it from the app.")
    await expect(ask.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    await shot(ask, 'w1-close-account-dialog')
    await ask.getByRole('button', { name: 'Close account', exact: true }).click()
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
  const inBefore = await moneyIn(page)
  expect(moneyIn).toBe(0)

  await test.step('Log receipt for the QA W3 lend: 200 into QNB', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: 'Log receipt from QA W3 lend' }).click()
    const d = dialog(page, 'Record money received')
    await expect(d).toContainText('Owed to you')
    await d.getByRole('textbox', { name: 'Amount' }).fill('200')
    await d.getByRole('button', { name: 'QNB Alahli', exact: true }).first().click()
    await blur(page)
    await d.getByRole('button', { name: /^(Mark repaid|Receive [\d,]+ EGP)$/ }).click()
    await expect(d).toBeHidden()
  })

  await test.step('one debt payment row, no income event, no expense', async () => {
    await serverRows('debt_payments', user.id, `debt_id=eq.${debt.id}`, (r: any[]) => r.length === 1 && Number(r[0].amount) === 200 && r[0].payment_method_id === qnb.id)
    expect(await serverRows('income_events', user.id, 'select=id', () => true)).toHaveLength(0)
    expect(await serverRows('expenses', user.id, 'select=id&deleted_at=is.null', () => true)).toHaveLength(0)
  })

  await test.step('QNB is 200 higher; Flow shows the repayment as Not income; Money in unchanged', async () => {
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /QNB Alahli/ }).first()).toContainText(shown('5,200'))
    await goto(page, '/flow')
    const main = page.locator('main')
    await expect(main.getByText('Repaid by Omar').first()).toBeVisible()
    await expect(main.getByText('Not income').first()).toBeVisible()
    expect(await moneyIn(page)).toBe(inBefore)
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
    await d.getByRole('switch', { name: 'Default for new expenses' }).click()
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === qnb.id && m.isDefault))
    await serverRows('payment_methods', user.id, `id=eq.${qnb.id}`, (r: any[]) => r[0]?.is_default === true)
    await goto(page, '/flow')
    await addExpense(page, { amount: 11, description: 'QA W7 two', category: 'Food' })
    expect(await methodOf('QA W7 two')).toBe(qnb.id)
  })

  await test.step('the Cash row menu sets Cash as default again', async () => {
    await goto(page, '/accounts')
    // Untracked Cash is the dimmed "Cash on hand · Not tracked" row: Start tracking, and its menu beside it.
    const row = page.locator('div', { has: page.getByRole('button', { name: 'Start tracking' }) }).last()
    await row.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Set as default' }).click()
    const cash = await localWait(page, (s) => s.paymentMethods.find((m: any) => m.type === 'cash' && m.isDefault && m.id !== 'pm_default_cash'))
    await localWait(page, (s) => s.paymentMethods.find((m: any) => m.id === qnb.id && !m.isDefault))
    await goto(page, '/flow')
    await addExpense(page, { amount: 12, description: 'QA W7 three', category: 'Food' })
    expect(await methodOf('QA W7 three')).toBe(cash.id)
  })
})

test('W8 lending from a tracked account takes the money out of it; the repayment puts it back, nothing is created [DR-6]', async ({ page, user }) => {
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 20000)])
  await localMethod(page, cib.id)
  await goto(page, '/accounts')
  await expect.poll(() => netWorth(page)).toBe(20000)

  await test.step('New borrow, Owed to me, 5,000 given via CIB: the sheet asks whether the money left CIB, Yes by default', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: /^(Add a debt|New debt)$/ }).first().click()
    await dialog(page, 'Add debt').getByRole('button', { name: /^Borrow / }).click()
    const d = dialog(page, 'New borrow')
    await d.getByRole('radio', { name: 'Owed to me' }).click()
    await d.getByRole('textbox', { name: 'e.g. Ahmed' }).fill('Omar')
    await d.getByRole('textbox', { name: 'e.g. Rent help' }).fill('QA W8 lend')
    await d.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await blur(page)
    await chooseMethod(page, d, 'CIB')
    const ask = d.getByRole('radiogroup', { name: 'Did this money leave CIB now?' })
    await expect(ask.getByRole('radio', { name: 'Yes' })).toBeChecked()
    await expect(d).toContainText('It is not counted as spending.')
    await shot(d, 'w8-add-debt-left-cib-question')
    await d.getByRole('button', { name: 'Add borrow' }).click()
    await expect(d).toBeHidden()
  })

  const debt = await localWait(page, (s) => s.debts.find((x: any) => x.name === 'QA W8 lend'))

  await test.step('the leg is on the debt row; no expense and no income row was written', async () => {
    await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => r[0]?.principal_payment_method_id === cib.id && Number(r[0]?.principal_amount) === 5000 && r[0]?.principal_currency === 'EGP' && !!r[0]?.principal_at)
    expect(await serverRows('expenses', user.id, 'select=id&deleted_at=is.null', () => true)).toHaveLength(0)
    expect(await serverRows('income_events', user.id, 'select=id', () => true)).toHaveLength(0)
  })

  await test.step('CIB and net worth are 5,000 lower; Money in is untouched', async () => {
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /^CIB/ }).first()).toContainText(shown('15,000'))
    await expect.poll(() => netWorth(page)).toBe(15000)
    await goto(page, '/flow')
    expect(await moneyIn(page)).toBe(0)
  })

  await test.step('Omar repays 5,000 into CIB: the account and net worth are back where they started', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: 'Log receipt from QA W8 lend' }).click()
    const d = dialog(page, 'Record money received')
    await d.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await chooseMethod(page, d, 'CIB')
    await blur(page)
    await d.getByRole('button', { name: /^(Mark repaid|Receive [\d,]+ EGP)$/ }).click()
    await expect(d).toBeHidden()
    await goto(page, '/accounts')
    await expect(page.getByRole('button', { name: /^CIB/ }).first()).toContainText(shown('20,000'))
    await expect.poll(() => netWorth(page)).toBe(20000)
  })
})

/** Debts > New borrow through CIB; `lend` flips it to Owed to me. Returns the sheet before saving. */
async function openBorrow(page: Page, o: { lend?: boolean; person: string; what: string; amount: number }) {
  await goto(page, '/debts')
  await page.getByRole('button', { name: /^(Add a debt|New debt)$/ }).first().click()
  await dialog(page, 'Add debt').getByRole('button', { name: /^Borrow / }).click()
  const d = dialog(page, 'New borrow')
  if (o.lend) await d.getByRole('radio', { name: 'Owed to me' }).click()
  await d.getByRole('textbox', { name: 'e.g. Ahmed' }).fill(o.person)
  await d.getByRole('textbox', { name: 'e.g. Rent help' }).fill(o.what)
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await blur(page)
  await chooseMethod(page, d, 'CIB')
  return d
}
const cibRow = async (page: Page) => { await goto(page, '/accounts'); return (await page.getByRole('button', { name: /^CIB/ }).first().textContent()) ?? '' }

test('W9 borrowed money that is already a bank deposit: in the CIB balance once, out of Money in, Flow says Not income [council Q3]', async ({ page, user }) => {
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 20000, { opening_at: hourAgo() })])
  // The deposit as the SMS route books an unmatched credit: source "other", confirmed, on the account, with its instant.
  await seed(page, user.id, 'income_events', [{ name: 'Bank credit', amount: 3000, currency: 'EGP', source_type: 'other', status: 'confirmed', received_date: today(), payment_method_id: cib.id, occurred_at: new Date().toISOString() }])
  await localMethod(page, cib.id)
  await goto(page, '/flow')
  await expect.poll(() => moneyIn(page)).toBe(3000)
  await expect.poll(() => cibRow(page)).toMatch(shown('23,000'))

  const d = await openBorrow(page, { person: 'Ahmed', what: 'QA W9 borrow', amount: 3000 })
  // A credit is linked only on the user's own Yes: the switch starts off.
  const link = d.getByRole('switch', { name: /^That.s the deposit on/ })
  await expect(link).not.toBeChecked()
  await link.click()
  await expect(d).toContainText('Already added to CIB. It stops counting as income.')
  await d.getByRole('button', { name: 'Add borrow' }).click()
  await expect(d).toBeHidden()
  const debt = await localWait(page, (s) => s.debts.find((x: any) => x.name === 'QA W9 borrow'))

  await serverRows('income_events', user.id, 'select=id,linked_debt_id,source_type', (r: any[]) => r.length === 1 && r[0].linked_debt_id === debt.id && r[0].source_type === 'other')
  await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => r.length === 1 && r[0].principal_payment_method_id === null)
  // CIB holds the money once (20,000 + 3,000); net worth = 23,000 - 3,000 owed = 20,000.
  await expect.poll(() => cibRow(page)).toMatch(shown('23,000'))
  await expect.poll(() => netWorth(page)).toBe(20000)
  await goto(page, '/flow')
  await expect.poll(() => moneyIn(page)).toBe(0)
  const row = page.locator('main').getByRole('button').filter({ hasText: 'Bank credit' }).first()
  await expect(row).toContainText('Not income')
  await shot(row, 'w9-borrowed-not-income-row')
})

/** Lends 5,000 to Omar through CIB with the leg, then a bank transfer of the same money arrives (a late SMS). */
async function lendThenLateRow(page: Page, userId: string) {
  const [cib] = await seed(page, userId, 'payment_methods', [bank('CIB', 20000, { opening_at: hourAgo() })])
  await localMethod(page, cib.id)
  const d = await openBorrow(page, { lend: true, person: 'Omar', what: 'QA late lend', amount: 5000 })
  await expect(d.getByRole('radiogroup', { name: 'Did this money leave CIB now?' }).getByRole('radio', { name: 'Yes' })).toBeChecked()
  await d.getByRole('button', { name: 'Add borrow' }).click()
  await expect(d).toBeHidden()
  const debt = await localWait(page, (s) => s.debts.find((x: any) => x.name === 'QA late lend'))
  await serverRows('debts', userId, `id=eq.${debt.id}`, (r: any[]) => Number(r[0]?.principal_amount) === 5000)
  await expect.poll(() => cibRow(page)).toMatch(shown('15,000'))
  // The transfer as the SMS route books it: an Instapay expense on CIB with its instant, after the debt.
  const [late] = await seed(page, userId, 'expenses', [{ amount: 5000, currency: 'EGP', category: 'Instapay', description: 'Instapay transfer', expense_date: today(), occurred_at: new Date().toISOString(), payment_method_id: cib.id }])
  // Counted twice until the user answers: 20,000 - 5,000 (leg) - 5,000 (row) = 10,000.
  await expect.poll(() => cibRow(page)).toMatch(shown('10,000'))
  await goto(page, '/flow')
  const prompt = page.getByText(/^Is this the 5,000 EGP you lent Omar\?$/)
  await expect(prompt).toBeVisible()
  return { cib, debt, late, prompt }
}

test('W10 a late bank row after a lend with a leg: Flow asks "same money?", Yes leaves one debit [council Q4]', async ({ page, user }) => {
  const { debt, late, prompt } = await lendThenLateRow(page, user.id)
  const card = prompt.locator('xpath=ancestor::*[.//button[normalize-space()="Yes, same money"]][1]')
  await expect(card).toContainText('CIB already moved for this debt, so the amount is counted twice right now.')
  await shot(card, 'w10-flow-same-money-prompt')
  await card.getByRole('button', { name: 'Yes, same money' }).click()
  await expect(prompt).toBeHidden()
  // One debit: the bank row stays and becomes the principal, the leg goes. 20,000 - 5,000 = 15,000; net worth 15,000.
  await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => r[0]?.principal_payment_method_id === null && r[0]?.principal_amount === null)
  await serverRows('expenses', user.id, `id=eq.${late.id}`, (r: any[]) => r[0]?.linked_debt_id === debt.id && r[0]?.spend_exclusion === 'manual')
  await expect.poll(() => cibRow(page)).toMatch(shown('15,000'))
  await expect.poll(() => netWorth(page)).toBe(15000)
})

test('W11 a late bank row after a lend with a leg: No keeps both and is not asked again [council Q4]', async ({ page, user }) => {
  const { debt, late, prompt } = await lendThenLateRow(page, user.id)
  await page.getByRole('button', { name: 'No, separate' }).click()
  await expect(prompt).toBeHidden()
  // Both stay as booked: the leg and the transfer, 20,000 - 5,000 - 5,000 = 10,000.
  await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => Number(r[0]?.principal_amount) === 5000)
  await serverRows('expenses', user.id, `id=eq.${late.id}`, (r: any[]) => r[0]?.linked_debt_id === null)
  await expect.poll(() => cibRow(page)).toMatch(shown('10,000'))
  // The answer is remembered (synced settings): a reload and a fresh visit to Flow do not ask again.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await goto(page, '/flow')
  await page.waitForTimeout(3000)
  await expect(page.getByText(/^Is this the 5,000 EGP you lent Omar\?$/)).toHaveCount(0)
})
