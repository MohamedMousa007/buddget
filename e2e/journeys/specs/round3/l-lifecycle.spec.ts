/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
// L1: one user, the whole money lifecycle through the UI. Two tracked accounts (CIB 20,000, QNB 10,000), the system
// Cash (untracked), and a pocket already set aside in CIB (3,000). Every step is checked against hand-computed numbers
// in three places: the Accounts screen (rows, Available now, In accounts, Set aside, net worth), the local store (the
// balance engine over the persisted ledger, pocket and goal rows) and the server (pocket, goal and debt rows; a fresh
// second sign-in re-derives the balances from server rows alone). Net worth moves only when money leaves or enters
// from outside (the loan out and its repayment); no step creates or destroys money.
import type { Browser, Locator, Page } from '@playwright/test'
import { computeBalances } from '../../../../src/lib/accounts/balance'
import { forceFlags, installApiShim } from '../../lib/apiShim'
import { expect, goto, localState, localWait, money, signIn, test, tile, inAccounts, setAside } from '../../lib/fixtures'
import { serverRows } from '../../lib/server'
import { blur, chooseMethod, dialog, openAccount, pickMethod, pickPocket, withdrawFor } from '../../lib/ui'
import { bank, localMethod, seed } from './seed'

/** [balance, set aside in it] per account; free = balance - set aside. */
type Acct = [number, number]
interface Expected { cib: Acct; qnb: Acct; pockets: Record<string, number>; netWorth: number }
interface Ids { cib: string; qnb: string; pockets: Record<string, string> }

const RAINY = 'QA L1 Rainy'
const TRIP = 'QA L1 Trip'
const GOAL = 'QA L1 Car'

async function netWorth(page: Page): Promise<number> {
  return money(await page.locator('main p').filter({ hasText: /Net worth\s*$/ }).first().textContent())
}

/**
 * One account row, light touch: "CIB · 1 account · 0 cards · 20,000 EGP · 3,000 set aside" (or "−1,000 EGP"). The
 * set-aside part only shows while something is set aside; free = balance − set aside, null when nothing is.
 */
async function row(page: Page, name: RegExp): Promise<{ balance: number; free: number | null }> {
  const t = ((await page.getByRole('button', { name }).first().textContent()) ?? '').replace(/\s+/g, ' ')
  const m = t.match(/([−-])?([\d,]+(?:\.\d+)?) ?EGP/)
  const balance = (m?.[1] ? -1 : 1) * Number(m?.[2].replace(/,/g, ''))
  const held = t.match(/([\d,]+(?:\.\d+)?) set aside/)?.[1]
  return { balance, free: held ? balance - Number(held.replace(/,/g, '')) : null }
}

/** The Accounts screen shows exactly the expected money. */
async function checkScreen(page: Page, e: Expected) {
  await goto(page, '/accounts')
  const free = (a: Acct) => a[0] - a[1]
  for (const [name, a] of [[/^CIB/, e.cib], [/^QNB Alahli/, e.qnb]] as const) {
    await expect.poll(() => row(page, name), { message: `row ${name}` }).toEqual({ balance: a[0], free: a[1] > 0 ? free(a) : null })
  }
  await expect.poll(() => tile(page, 'Available now')).toBe(free(e.cib) + free(e.qnb))
  await expect.poll(() => inAccounts(page)).toBe(e.cib[0] + e.qnb[0])
  await expect.poll(() => setAside(page)).toBe(e.cib[1] + e.qnb[1])
  await expect.poll(() => netWorth(page)).toBe(e.netWorth)
}

async function check(page: Page, userId: string, ids: Ids, e: Expected) {
  await checkScreen(page, e)
  // Store: the balance engine over the persisted ledger; Cash stays untracked, so only the two banks have a balance.
  await expect.poll(async () => {
    const s = await localState(page)
    const b = computeBalances({ ...s, adjustments: s.accountAdjustments ?? [], convert: (a: number, f: string, t: string) => (f === t ? a : null) })
    const pick = (id: string) => [b.get(id)?.balance, b.get(id)?.held]
    const pockets = Object.fromEntries(Object.entries(ids.pockets).map(([n, id]) => [n, s.savingsAccounts.find((x: any) => x.id === id)?.currentBalance ?? null]))
    return { tracked: b.size, cib: pick(ids.cib), qnb: pick(ids.qnb), pockets }
  }, { message: 'store' }).toEqual({ tracked: 2, cib: e.cib, qnb: e.qnb, pockets: e.pockets })
  // Server: every pocket's stored balance (a deleted pocket carries deleted_at).
  for (const [n, id] of Object.entries(ids.pockets)) {
    const want = e.pockets[n]
    await serverRows('savings_accounts', userId, `id=eq.${id}&select=current_balance,deleted_at`, (r: any[]) =>
      want == null ? !r[0] || !!r[0].deleted_at : Number(r[0]?.current_balance) === want && !r[0].deleted_at)
  }
}

/** A second device: signs in fresh, so every number is rebuilt from server rows only. */
async function checkFromServer(browser: Browser, email: string, e: Expected) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, baseURL: test.info().project.use.baseURL, bypassCSP: true, timezoneId: 'Africa/Cairo', locale: 'en-US' })
  try {
    await installApiShim(ctx)
    await forceFlags(ctx, { onboarding_v1: false })
    const p = await ctx.newPage()
    await signIn(p, email)
    await checkScreen(p, e)
  } finally {
    await ctx.close()
  }
}

async function newPocket(page: Page, o: { kind: RegExp; name: string; amount: number }) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add pocket or asset' }).click()
  const add = dialog(page, 'Add to Wealth')
  await add.getByRole('radio', { name: o.kind }).click()
  await add.getByRole('button', { name: 'Continue' }).click()
  const form = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Create pocket' }) })
  await form.getByRole('textbox').first().fill(o.name)
  await form.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await blur(page)
  await form.getByRole('button', { name: 'Create pocket' }).click()
  await expect(form).toBeHidden()
  return localWait(page, (s) => s.savingsAccounts.find((a: any) => a.name === o.name))
}

/** An account field ("From", "To"; light touch: "From: CIB") that opens the method carousel: choose the account unless it is already chosen. */
async function pickAccount(sheet: Locator, label: string, name: string) {
  // "From: CIB" carries an aria-label; Withdraw's "To CIB" is named by its text.
  const field = sheet.getByRole('button', { name: new RegExp(`^${label}:? `) })
  const now = async () => ((await field.getAttribute('aria-label')) ?? (await field.textContent()) ?? '').replace(/\s+/g, ' ').replace(`${label}:`, label)
  if ((await now()) === `${label} ${name}` || (await now()) === `${label}${name}`) return
  await field.click()
  await pickMethod(sheet.page(), new RegExp(`^${name}`))
  await expect.poll(now).toMatch(new RegExp(`^${label} ?${name}$`))
}

/** Fund it > "Where is it?" Account: the account the saved money sits in (an account field, or chips when the sheet lists them). */
async function pickInlineAccount(page: Page, sheet: Locator, name: string) {
  const field = sheet.getByRole('button', { name: /^(Kept in|Account|In|Where)\b.*:/ })
  if (await field.count()) {
    if (((await field.first().getAttribute('aria-label')) ?? '').endsWith(`: ${name}`)) return
    await field.first().click()
    return pickMethod(page, new RegExp(`^${name}`))
  }
  const radio = sheet.getByRole('radio', { name: new RegExp(`^${name}`) })
  if (await radio.count()) return radio.first().click()
  await chooseMethod(page, sheet, name)
}

/** Wealth > Add money into a pocket; returns the sheet so a refusal can be read before submitting. */
async function openAddMoney(page: Page, pocket: string, amount: number, fromAccount?: string) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add money' }).first().click()
  const d = dialog(page, 'Add money')
  await pickPocket(page, d, 'Into', new RegExp(pocket))
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
  await blur(page)
  if (fromAccount) await pickAccount(d, 'From', fromAccount)
  return d
}
async function addMoney(page: Page, pocket: string, amount: number, fromAccount?: string) {
  const d = await openAddMoney(page, pocket, amount, fromAccount)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: 'Add money', exact: true }).click()
  await expect(d).toBeHidden()
}

/** Wealth > Withdraw from a pocket for a purpose ("Back into this month" keeps a held pocket's money in its account). */
async function withdraw(page: Page, o: { from: string; amount: number; purpose: RegExp; moveTo?: string; toAccount?: string }) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Withdraw' }).first().click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
  await pickPocket(page, d, 'From', new RegExp(o.from))
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await withdrawFor(page, d, o.purpose)
  // Light touch: "Move to a pocket" adds an "Into" pocket field with the provider-style pocket picker.
  if (o.moveTo) await pickPocket(page, d, 'Into', new RegExp(`^${o.moveTo}`))
  if (o.toAccount) await pickAccount(d, 'To', o.toAccount)
  await blur(page)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: `Withdraw ${o.amount.toLocaleString('en-US')}`, exact: true }).click()
  await expect(d).toBeHidden()
}

/**
 * Accounts > account > Set aside: puts the account's own free money aside in a pocket. Wealth > Add money does the same
 * when its "From" is the account holding the pocket, which is its default (see L2).
 */
async function openSetAside(page: Page, account: RegExp, pocket: string, amount: number) {
  // Light touch: a bank row opens its provider page ("Total here"); the account row there opens the account sheet.
  const detail = await openAccount(page, account)
  await detail.getByRole('button', { name: 'Set aside', exact: true }).click()
  const d = page.getByRole('dialog', { name: /^Set aside in / }).last()
  await pickPocket(page, d, 'Into', new RegExp(`^${pocket}`))
  await expect(d).toContainText(/Stays in CIB/)
  await d.getByRole('textbox', { name: /^Set aside in / }).fill(String(amount))
  await blur(page)
  return d
}

/** Wealth > pocket > Delete > confirm. Returns whether the pocket stayed gone for 3 s in the store (see L3). */
async function deletePocket(page: Page, name: string, id: string): Promise<{ stuck: boolean; copy: string }> {
  // A fresh load, as when the app is opened: its first server pull runs while the user acts.
  await goto(page, '/wealth')
  await page.getByRole('button', { name: new RegExp(name) }).first().click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const ask = page.getByRole('alertdialog').filter({ hasText: `Delete ${name}?` })
  await expect(ask).toBeVisible()
  const copy = ((await ask.textContent()) ?? '').replace(/\s+/g, ' ')
  await ask.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(ask).toBeHidden()
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(200)
    if ((await localState(page)).savingsAccounts.some((a: any) => a.id === id)) return { stuck: false, copy }
  }
  return { stuck: true, copy }
}

async function fundGoal(page: Page, amount: number) {
  // Light touch: the goal row opens its detail, whose Add money sheet funds it from the account holding its pocket.
  await goto(page, '/goals')
  await page.getByRole('button', { name: new RegExp(`^${GOAL}`) }).first().click()
  await page.getByRole('button', { name: 'Add money', exact: true }).click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
  await expect(d).toContainText('QNB Alahli')
  await blur(page)
  await d.getByRole('button', { name: /^(Add to goal|Add money)$/ }).click()
  await expect(d).toBeHidden()
}

test('L1 one user, the whole money lifecycle: pockets, goal, reserve cap, lending, achieve, delete', async ({ page, user, browser }) => {
  test.setTimeout(20 * 60_000)
  const hour = new Date(Date.now() - 3_600_000).toISOString()
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 20000, { opening_at: hour })])
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 10000, { opening_at: hour })])
  await localMethod(page, cib.id)
  await localMethod(page, qnb.id)
  const rainy = await newPocket(page, { kind: /^CIB/, name: RAINY, amount: 3000 })
  expect(rainy.heldInPaymentMethodId).toBe(cib.id)
  const ids: Ids = { cib: cib.id, qnb: qnb.id, pockets: { [RAINY]: rainy.id } }

  // Start: CIB 20,000 with 3,000 set aside (free 17,000); QNB 10,000 (free 10,000). Net worth = 20,000 + 10,000 = 30,000
  // (the held pocket is inside CIB, never counted twice; untracked Cash counts nothing).
  await check(page, user.id, ids, { cib: [20000, 3000], qnb: [10000, 0], pockets: { [RAINY]: 3000 }, netWorth: 30000 })

  const goal = await test.step('1. new goal, target 10,000, "Already saved" 2,000 in QNB', async () => {
    await goto(page, '/goals')
    await page.getByRole('button', { name: 'Start from scratch' }).click()
    const d = dialog(page, 'New goal')
    await d.getByRole('button', { name: 'Vacation' }).click()
    await d.getByRole('textbox', { name: 'Goal name' }).fill(GOAL)
    await d.getByRole('textbox', { name: 'Target Amount' }).fill('10000')
    await blur(page)
    await d.getByRole('button', { name: /^Fund it/ }).click()
    const fundIt = dialog(page, 'Fund it')
    await fundIt.getByRole('radiogroup', { name: 'Where is it?' }).getByRole('radio', { name: 'Account' }).click()
    await pickInlineAccount(page, fundIt, 'QNB Alahli')
    await fundIt.getByRole('textbox', { name: 'Already saved' }).fill('2000')
    await expect(fundIt.getByRole('alert')).toHaveCount(0)
    await blur(page)
    await fundIt.getByRole('radio', { name: /add money myself/ }).click()
    await fundIt.getByRole('button', { name: 'Done' }).click()
    await d.getByRole('button', { name: 'Create goal' }).click()
    await expect(d).toBeHidden()
    const g = await localWait(page, (s) => s.goals.find((x: any) => x.name === GOAL && x.linkedSavingsAccountIds?.length === 1))
    const pocket = await localWait(page, (s) => s.savingsAccounts.find((a: any) => a.id === g.linkedSavingsAccountIds[0]))
    expect(pocket.heldInPaymentMethodId).toBe(qnb.id)
    ids.pockets[GOAL] = pocket.id
    // QNB keeps 10,000 and sets 2,000 aside (free 8,000); nothing new entered, net worth stays 30,000.
    await check(page, user.id, ids, { cib: [20000, 3000], qnb: [10000, 2000], pockets: { [RAINY]: 3000, [GOAL]: 2000 }, netWorth: 30000 })
    await serverRows('goals', user.id, `id=eq.${g.id}`, (r: any[]) => Number(r[0]?.target_amount) === 10000 && r[0]?.status !== 'achieved')
    return { goal: g, pocketName: pocket.name as string }
  })

  await test.step('2. add a new pocket outside the accounts (cash at home), empty', async () => {
    // One account holds at most one pocket made "from an account you already have" (CIB already holds Rainy), so the
    // new pocket is a standalone one: money put in it leaves the account it came from.
    const trip = await newPocket(page, { kind: /^Cash At home/, name: TRIP, amount: 0 })
    expect(trip.heldInPaymentMethodId ?? null).toBeNull()
    ids.pockets[TRIP] = trip.id
    // An empty pocket moves nothing.
    await check(page, user.id, ids, { cib: [20000, 3000], qnb: [10000, 2000], pockets: { [RAINY]: 3000, [GOAL]: 2000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('3. add 4,000 to it from CIB', async () => {
    await addMoney(page, TRIP, 4000, 'CIB')
    // The money leaves CIB for the pocket: CIB 20,000 - 4,000 = 16,000 (Rainy's 3,000 still set aside), Trip 4,000.
    // Net worth = 16,000 + 10,000 + Trip 4,000 = 30,000.
    await check(page, user.id, ids, { cib: [16000, 3000], qnb: [10000, 2000], pockets: { [RAINY]: 3000, [GOAL]: 2000, [TRIP]: 4000 }, netWorth: 30000 })
  })

  await test.step('4. withdraw 1,000 of it back into CIB', async () => {
    await withdraw(page, { from: TRIP, amount: 1000, purpose: /^Income Back into this month/, toAccount: 'CIB' })
    // Trip 4,000 - 1,000 = 3,000; CIB 16,000 + 1,000 = 17,000. Net worth 17,000 + 10,000 + 3,000 = 30,000.
    await check(page, user.id, ids, { cib: [17000, 3000], qnb: [10000, 2000], pockets: { [RAINY]: 3000, [GOAL]: 2000, [TRIP]: 3000 }, netWorth: 30000 })
  })

  await test.step('5a. fund the goal from a pocket: move Trip\'s 3,000 into the goal pocket (held in QNB)', async () => {
    await withdraw(page, { from: TRIP, amount: 3000, purpose: /^Move to a pocket/, moveTo: goal.pocketName })
    // The money arrives in QNB, where the goal pocket lives: QNB 10,000 + 3,000 = 13,000 with 2,000 + 3,000 = 5,000
    // set aside; Trip 0. Net worth 17,000 + 13,000 + 0 = 30,000.
    await check(page, user.id, ids, { cib: [17000, 3000], qnb: [13000, 5000], pockets: { [RAINY]: 3000, [GOAL]: 5000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('5b. fund the goal from its account: 2,000 set aside in QNB', async () => {
    await fundGoal(page, 2000)
    // Goal 5,000 + 2,000 = 7,000, all inside QNB (13,000, free 6,000).
    const e: Expected = { cib: [17000, 3000], qnb: [13000, 7000], pockets: { [RAINY]: 3000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 }
    await check(page, user.id, ids, e)
    await checkFromServer(browser, user.email, e)
  })

  await test.step('6. release from a pocket whose account has 0 free [R8]', async () => {
    // CIB free = 17,000 - 3,000 = 14,000: set all of it aside in Rainy (3,000 + 14,000 = 17,000), so CIB has 0 free.
    const d = await openSetAside(page, /^CIB/, RAINY, 14000)
    await d.getByRole('button', { name: 'Set aside', exact: true }).click()
    await expect(d).toBeHidden()
    await check(page, user.id, ids, { cib: [17000, 17000], qnb: [13000, 7000], pockets: { [RAINY]: 17000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
    // With 0 free the pocket still gives money back inside CIB: Rainy 17,000 - 6,000 = 11,000, CIB free 6,000.
    await withdraw(page, { from: RAINY, amount: 6000, purpose: /^Income Back into this month/ })
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('7. setting aside more than free is refused with the amount', async () => {
    const d = await openSetAside(page, /^CIB/, RAINY, 6001)
    await expect(d).toContainText(/More than what is free \(6,000(\.00)?\)/)
    await expect(d.getByRole('button', { name: 'Set aside', exact: true })).toBeDisabled()
    // blur() left focus on the page body, where the sheet's Escape handler cannot hear it; close as a user taps.
    await d.getByRole('button', { name: 'Close' }).first().click()
    // Light touch guards a typed amount: "Discard this?" → Discard.
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(d).toBeHidden()
    // Nothing was written.
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('8. lend 5,000 from CIB (left now: Yes), then Omar repays it', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: /^(Add a debt|New debt)$/ }).first().click()
    await dialog(page, 'Add a debt').getByRole('radio', { name: /^Borrowed money/ }).click()
    const d = dialog(page, 'New borrow')
    await d.getByRole('radio', { name: 'Owed to me' }).click()
    await d.getByRole('textbox', { name: 'Person', exact: true }).fill('Omar')
    await d.getByRole('textbox', { name: 'For', exact: true }).fill('QA L1 lend')
    await d.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await blur(page)
    await d.getByRole('button', { name: /^Paid from/ }).click()
    await pickMethod(page, /^CIB/)
    await expect(d.getByRole('switch', { name: /^Left CIB now/ })).toBeChecked()
    await d.getByRole('button', { name: 'Add borrow' }).click()
    await expect(d).toBeHidden()
    const debt = await localWait(page, (s) => s.debts.find((x: any) => x.name === 'QA L1 lend'))
    await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => r[0]?.principal_payment_method_id === cib.id && Number(r[0]?.principal_amount) === 5000)
    // The money left: CIB 17,000 - 5,000 = 12,000 (11,000 set aside, free 1,000); net worth 30,000 - 5,000 = 25,000.
    const lent: Expected = { cib: [12000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 25000 }
    await check(page, user.id, ids, lent)
    await checkFromServer(browser, user.email, lent)

    await goto(page, '/debts')
    // Light touch: the debt row opens its actions; "Record money back" is the receipt sheet, its account behind "Into".
    await page.getByRole('button', { name: /^QA L1 lend/ }).first().click()
    await dialog(page, 'QA L1 lend').getByRole('radio', { name: 'Record money back' }).click()
    const r = dialog(page, /^Record money (received|back)$/)
    await r.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await chooseMethod(page, r, 'CIB')
    await blur(page)
    await r.getByRole('button', { name: /^(Mark repaid|Record|Receive [\d,]+ EGP|Save)$/ }).click()
    await expect(r).toBeHidden()
    await serverRows('debt_payments', user.id, `debt_id=eq.${debt.id}`, (rows: any[]) => rows.length === 1 && Number(rows[0].amount) === 5000)
    // Back: CIB 12,000 + 5,000 = 17,000 (free 6,000); net worth 30,000. No expense row anywhere.
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
    expect(await serverRows('expenses', user.id, 'select=id&deleted_at=is.null', () => true)).toHaveLength(0)
  })

  await test.step('9. reach the goal: the last 3,000 from QNB', async () => {
    await fundGoal(page, 3000)
    // Goal 7,000 + 3,000 = 10,000 = target; QNB 13,000 with 10,000 set aside (free 3,000).
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 10000], pockets: { [RAINY]: 11000, [GOAL]: 10000, [TRIP]: 0 }, netWorth: 30000 })
    await localWait(page, (s) => s.goals.find((x: any) => x.id === goal.goal.id && x.status === 'achieved'))
    await serverRows('goals', user.id, `id=eq.${goal.goal.id}`, (r: any[]) => r[0]?.status === 'achieved' && !!r[0].achieved_at)
  })

  await test.step('10. delete the Rainy pocket (11,000 set aside in CIB)', async () => {
    // A deleted pocket used to come back a moment later (finding L1-B, fixed, pinned by L3). This step is about the money
    // after a delete, so it still deletes again until the pocket stays gone and records how often it came back.
    let tries = 0
    for (; tries < 5; tries++) {
      const { stuck, copy } = await deletePocket(page, RAINY, ids.pockets[RAINY])
      if (tries === 0) test.info().annotations.push({ type: 'delete-copy', description: copy })
      if (stuck) break
    }
    test.info().annotations.push({ type: 'delete-resurrected', description: String(tries) })
    expect(tries).toBeLessThan(5)
    const rainyId = ids.pockets[RAINY]
    delete ids.pockets[RAINY]
    await localWait(page, (s) => !s.savingsAccounts.some((a: any) => a.id === rainyId))
    // The money was CIB's all along: CIB 17,000 with nothing set aside; net worth 17,000 + 13,000 = 30,000.
    const end: Expected = { cib: [17000, 0], qnb: [13000, 10000], pockets: { [GOAL]: 10000, [TRIP]: 0 }, netWorth: 30000 }
    await check(page, user.id, ids, end)
    await serverRows('savings_accounts', user.id, `id=eq.${rainyId}&select=deleted_at`, (r: any[]) => r.length === 0 || !!r[0].deleted_at)
    await checkFromServer(browser, user.email, end)
  })
})

test('L2 Wealth > Add money into a pocket held in CIB sets aside CIB\'s own money by default, and caps another source at its own free money [finding L1-A, fixed]', async ({ page, user }) => {
  const hour = new Date(Date.now() - 3_600_000).toISOString()
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 5000, { opening_at: hour })])
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 1000, { opening_at: hour })])
  await localMethod(page, cib.id)
  await localMethod(page, qnb.id)
  await newPocket(page, { kind: /^CIB/, name: RAINY, amount: 500 })
  await checkScreen(page, { cib: [5000, 500], qnb: [1000, 0], pockets: {}, netWorth: 6000 })

  // Another account as the source is a transfer out of it: 2,000 from QNB's 1,000 is refused, naming QNB.
  const refused = await openAddMoney(page, RAINY, 2000, 'QNB Alahli')
  // Light touch names the source on the Into line ("From QNB Alahli"); the refusal below names the account that lacks it.
  await expect(refused).toContainText('From QNB Alahli')
  await expect(refused.getByRole('alert')).toContainText(/Only 1,000(\.00)? EGP is available in QNB Alahli/)
  await expect(refused.getByRole('button', { name: 'Add money', exact: true })).toBeDisabled()

  // The default path: pocket picked, amount typed, nothing else touched. CIB has 4,500 free, QNB 1,000.
  const d = await openAddMoney(page, RAINY, 2000)
  await expect(d.getByRole('button', { name: /^From:/ })).toHaveAttribute('aria-label', 'From: CIB')
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: 'Add money', exact: true }).click()
  await expect(d).toBeHidden()
  await localWait(page, (s) => s.savingsTransactions.some((t: any) => t.amount === 2000))
  await goto(page, '/accounts')
  const tx = ((await localState(page)).savingsTransactions as any[]).map((t) => ({ type: t.type, amount: t.amount, pm: t.paymentMethodId === qnb.id ? 'QNB' : t.paymentMethodId === cib.id ? 'CIB' : t.paymentMethodId ?? null, cashFlow: t.isCashFlow, source: t.source }))
  test.info().annotations.push({ type: 'after', description: JSON.stringify({ cib: await row(page, /^CIB/), qnb: await row(page, /^QNB Alahli/), netWorth: await netWorth(page), tx }) })
  // No money is created and none moves: CIB's own money is set aside (5,000 with 2,500 set aside), QNB keeps its 1,000.
  await checkScreen(page, { cib: [5000, 2500], qnb: [1000, 0], pockets: {}, netWorth: 6000 })
  expect(tx.find((t) => t.amount === 2000)).toMatchObject({ type: 'deposit', pm: null })
})

test('L3 a pocket deleted from Wealth stays deleted [finding L1-B, fixed]', async ({ page, user }) => {
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 20000, { opening_at: new Date(Date.now() - 3_600_000).toISOString() })])
  await localMethod(page, cib.id)
  // A pocket that stays: the app refuses to delete the only pocket left ("Keep at least one pocket"), and the default
  // Monthly Savings pocket is not always there yet, so the fourth delete must not be the last pocket.
  await newPocket(page, { kind: /^Cash At home/, name: 'QA L3 keep', amount: 0 })
  const made = []
  for (const n of ['QA L3 one', 'QA L3 two', 'QA L3 three', 'QA L3 four']) made.push(await newPocket(page, { kind: /^Cash At home/, name: n, amount: 0 }))
  await page.waitForTimeout(3000)
  const results: boolean[] = []
  for (const p of made) results.push((await deletePocket(page, p.name, p.id)).stuck)
  test.info().annotations.push({ type: 'stayed-deleted', description: JSON.stringify(results) })
  // Before the fix (5 of 8 runs) the row left the store, came back within about 200 ms from a pull that was in flight,
  // and was never deleted on the server. Four deletes made the defect show in practically every run.
  expect(results).toEqual([true, true, true, true])
  for (const p of made) await serverRows('savings_accounts', user.id, `id=eq.${p.id}&select=deleted_at`, (r: any[]) => !!r[0]?.deleted_at)
})
