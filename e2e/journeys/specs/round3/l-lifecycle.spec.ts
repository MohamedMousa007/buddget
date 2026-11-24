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
import { expect, goto, knownBug, localState, localWait, money, signIn, test, tile } from '../../lib/fixtures'
import { serverRows } from '../../lib/server'
import { blur, chooseMethod, dialog, pickPocket } from '../../lib/ui'
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

/** "20,000.00" (or "−1,000.00") and "17,000 free" from one account row; the free label only shows while something is set aside. */
async function row(page: Page, name: RegExp): Promise<{ balance: number; free: number | null }> {
  const t = ((await page.getByRole('button', { name }).first().textContent()) ?? '').replace(/\s+/g, ' ')
  const m = t.match(/([−-])?([\d,]+)\.\d\d/)
  const balance = (m?.[1] ? -1 : 1) * Number(m?.[2].replace(/,/g, ''))
  const free = t.match(/([\d,]+) free/)?.[1]
  return { balance, free: free ? Number(free.replace(/,/g, '')) : null }
}

/** The Accounts screen shows exactly the expected money. */
async function checkScreen(page: Page, e: Expected) {
  await goto(page, '/accounts')
  const free = (a: Acct) => a[0] - a[1]
  for (const [name, a] of [[/^CIB/, e.cib], [/^QNB Alahli/, e.qnb]] as const) {
    await expect.poll(() => row(page, name), { message: `row ${name}` }).toEqual({ balance: a[0], free: a[1] > 0 ? free(a) : null })
  }
  await expect.poll(() => tile(page, 'Available now')).toBe(free(e.cib) + free(e.qnb))
  await expect.poll(() => tile(page, 'In accounts')).toBe(e.cib[0] + e.qnb[0])
  await expect.poll(() => tile(page, 'Set aside')).toBe(e.cib[1] + e.qnb[1])
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

/** An inline account picker ("From account", "To account"): unfold it and choose the account unless it is already chosen. */
async function pickAccount(sheet: Locator, label: string, name: string) {
  const field = sheet.getByRole('button', { name: new RegExp(`^${label}`) })
  if (((await field.textContent()) ?? '').includes(`${label}${name}`)) return
  await field.click()
  await sheet.getByRole('option', { name: new RegExp(`^${name}`) }).click()
  await expect(field).toContainText(`${label}${name}`)
}

/** Wealth > Add money into a pocket; returns the sheet so a refusal can be read before submitting. */
async function openAddMoney(page: Page, pocket: string, amount: number, fromAccount?: string) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add money' }).first().click()
  const d = dialog(page, 'Add money')
  await pickPocket(page, d, 'Into', new RegExp(pocket))
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
  await blur(page)
  if (fromAccount) await pickAccount(d, 'From account', fromAccount)
  return d
}
async function addMoney(page: Page, pocket: string, amount: number, fromAccount?: string) {
  const d = await openAddMoney(page, pocket, amount, fromAccount)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: new RegExp(`^Add [\\d,]+ to ${pocket}`) }).click()
  await expect(d).toBeHidden()
}

/** Wealth > Withdraw from a pocket for a purpose ("Back into this month" keeps a held pocket's money in its account). */
async function withdraw(page: Page, o: { from: string; amount: number; purpose: string; moveTo?: string; toAccount?: string }) {
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Withdraw' }).first().click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Amount' }) }).last()
  await pickPocket(page, d, 'From', new RegExp(o.from))
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(o.amount))
  await d.getByRole('radio').filter({ hasText: o.purpose }).click()
  if (o.moveTo) await d.getByRole('button', { name: o.moveTo, exact: true }).click()
  if (o.toAccount) await pickAccount(d, 'To account', o.toAccount)
  await blur(page)
  await expect(d.getByRole('alert')).toHaveCount(0)
  await d.getByRole('button', { name: new RegExp(`${o.amount.toLocaleString('en-US')} from ${o.from}`) }).click()
  await expect(d).toBeHidden()
}

/**
 * Accounts > account > Set aside: puts the account's own free money aside in a pocket. This is the path that sets money
 * aside from the account that holds the pocket: Wealth > Add money never offers the holder itself as "From account"
 * (see L2), so with a second account it would book a transfer from that one instead.
 */
async function openSetAside(page: Page, account: RegExp, pocket: string, amount: number) {
  await goto(page, '/accounts')
  await page.getByRole('button', { name: account }).first().click()
  const detail = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Update' }) }).last()
  await detail.getByRole('button', { name: 'Set aside', exact: true }).click()
  const d = page.getByRole('dialog').filter({ has: page.getByRole('radiogroup', { name: 'Set aside' }) }).last()
  await d.getByRole('radiogroup', { name: 'Set aside' }).getByRole('button', { name: pocket, exact: true }).click()
  await expect(d).toContainText('Stays in this account')
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
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
  await goto(page, '/goals')
  await page.getByRole('button', { name: /Add money/ }).first().click()
  const d = dialog(page, `Add money to ${GOAL}`)
  await d.getByRole('textbox', { name: 'Amount' }).fill(String(amount))
  await expect(d).toContainText('Set aside in QNB Alahli')
  await blur(page)
  await d.getByRole('button', { name: 'Add money', exact: true }).click()
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
    const d = dialog(page, 'Add a goal')
    await d.getByRole('button', { name: 'Vacation' }).click()
    await d.getByRole('textbox', { name: 'Name' }).fill(GOAL)
    await d.getByRole('textbox', { name: 'Target Amount' }).fill('10000')
    const saved = d.getByRole('textbox', { name: 'Already saved' })
    if (!(await saved.isVisible().catch(() => false))) {
      await blur(page)
      await d.getByRole('button', { name: 'Next: fund it' }).click()
    }
    await saved.fill('2000')
    await d.getByRole('radiogroup', { name: 'Where is this money?' }).getByRole('radio', { name: /^QNB Alahli/ }).click()
    await expect(d.getByRole('alert')).toHaveCount(0)
    await blur(page)
    const next = d.getByRole('button', { name: 'Next: fund it' })
    if (await next.isVisible().catch(() => false)) await next.click()
    await d.getByRole('radio', { name: /^I will add money myself/ }).click()
    await d.getByRole('button', { name: 'Start my goal' }).click()
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
    await withdraw(page, { from: TRIP, amount: 1000, purpose: 'Back into this month', toAccount: 'CIB' })
    // Trip 4,000 - 1,000 = 3,000; CIB 16,000 + 1,000 = 17,000. Net worth 17,000 + 10,000 + 3,000 = 30,000.
    await check(page, user.id, ids, { cib: [17000, 3000], qnb: [10000, 2000], pockets: { [RAINY]: 3000, [GOAL]: 2000, [TRIP]: 3000 }, netWorth: 30000 })
  })

  await test.step('5a. fund the goal from a pocket: move Trip\'s 3,000 into the goal pocket (held in QNB)', async () => {
    await withdraw(page, { from: TRIP, amount: 3000, purpose: 'Stays inside your savings', moveTo: goal.pocketName })
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
    await d.getByRole('button', { name: `Set aside 14,000.00 in ${RAINY}` }).click()
    await expect(d).toBeHidden()
    await check(page, user.id, ids, { cib: [17000, 17000], qnb: [13000, 7000], pockets: { [RAINY]: 17000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
    // With 0 free the pocket still gives money back inside CIB: Rainy 17,000 - 6,000 = 11,000, CIB free 6,000.
    await withdraw(page, { from: RAINY, amount: 6000, purpose: 'Back into this month' })
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('7. setting aside more than free is refused with the amount', async () => {
    const d = await openSetAside(page, /^CIB/, RAINY, 6001)
    await expect(d).toContainText('More than what is free (6,000.00)')
    await expect(d.getByRole('button', { name: `Set aside 6,001.00 in ${RAINY}` })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    // Nothing was written.
    await check(page, user.id, ids, { cib: [17000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 30000 })
  })

  await test.step('8. lend 5,000 from CIB (left now: Yes), then Omar repays it', async () => {
    await goto(page, '/debts')
    await page.getByRole('button', { name: /^(Add a debt|New debt)$/ }).first().click()
    await dialog(page, 'Add debt').getByRole('button', { name: /^Borrow / }).click()
    const d = dialog(page, 'New borrow')
    await d.getByRole('radio', { name: 'Owed to me' }).click()
    await d.getByRole('textbox', { name: 'e.g. Ahmed' }).fill('Omar')
    await d.getByRole('textbox', { name: 'e.g. Rent help' }).fill('QA L1 lend')
    await d.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await blur(page)
    await chooseMethod(page, d, 'CIB')
    await expect(d.getByRole('radiogroup', { name: 'Did this money leave CIB now?' }).getByRole('radio', { name: 'Yes' })).toBeChecked()
    await d.getByRole('button', { name: 'Add borrow' }).click()
    await expect(d).toBeHidden()
    const debt = await localWait(page, (s) => s.debts.find((x: any) => x.name === 'QA L1 lend'))
    await serverRows('debts', user.id, `id=eq.${debt.id}`, (r: any[]) => r[0]?.principal_payment_method_id === cib.id && Number(r[0]?.principal_amount) === 5000)
    // The money left: CIB 17,000 - 5,000 = 12,000 (11,000 set aside, free 1,000); net worth 30,000 - 5,000 = 25,000.
    const lent: Expected = { cib: [12000, 11000], qnb: [13000, 7000], pockets: { [RAINY]: 11000, [GOAL]: 7000, [TRIP]: 0 }, netWorth: 25000 }
    await check(page, user.id, ids, lent)
    await checkFromServer(browser, user.email, lent)

    await goto(page, '/debts')
    await page.getByRole('button', { name: 'Log receipt from QA L1 lend' }).click()
    const r = dialog(page, 'Record money received')
    await r.getByRole('textbox', { name: 'Amount' }).fill('5000')
    await chooseMethod(page, r, 'CIB')
    await blur(page)
    await r.getByRole('button', { name: /^Receive 5,000 EGP$/ }).click()
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
    // A deleted pocket can come back a moment later (finding L1-B, pinned by L3). This step is about the money after a
    // delete, so it deletes again until the pocket stays gone and records how often it came back.
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

test('L2 Wealth > Add money into a pocket held in CIB books a transfer from the other account, with no check on that account [finding L1-A]', async ({ page, user }) => {
  const hour = new Date(Date.now() - 3_600_000).toISOString()
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 5000, { opening_at: hour })])
  const [qnb] = await seed(page, user.id, 'payment_methods', [bank('QNB Alahli', 1000, { opening_at: hour })])
  await localMethod(page, cib.id)
  await localMethod(page, qnb.id)
  await newPocket(page, { kind: /^CIB/, name: RAINY, amount: 500 })
  await checkScreen(page, { cib: [5000, 500], qnb: [1000, 0], pockets: {}, netWorth: 6000 })

  // The default path: pocket picked, amount typed, nothing else touched. CIB has 4,500 free, QNB 1,000.
  const d = await openAddMoney(page, RAINY, 2000)
  const source = ((await d.getByRole('button', { name: /^From account/ }).textContent().catch(() => null)) ?? 'none').replace(/\s+/g, ' ')
  test.info().annotations.push({ type: 'default-source', description: source })
  const cta = d.getByRole('button', { name: new RegExp(`^Add [\\d,]+ to ${RAINY}`) })
  if (await cta.isEnabled()) { await cta.click(); await expect(d).toBeHidden() }
  await page.waitForTimeout(1500)
  await goto(page, '/accounts')
  const tx = ((await localState(page)).savingsTransactions as any[]).map((t) => ({ type: t.type, amount: t.amount, pm: t.paymentMethodId === qnb.id ? 'QNB' : t.paymentMethodId === cib.id ? 'CIB' : t.paymentMethodId ?? null, cashFlow: t.isCashFlow, source: t.source }))
  test.info().annotations.push({ type: 'after', description: JSON.stringify({ cib: await row(page, /^CIB/), qnb: await row(page, /^QNB Alahli/), netWorth: await netWorth(page), tx }) })
  // Either fix creates no money: set aside from CIB's own money (CIB 5,000 with 2,500 set aside, QNB 1,000), or refuse
  // a 2,000 transfer out of QNB's 1,000. Today the sheet defaults to QNB (the holder is never offered as a source) and
  // books the deposit with no check on QNB (see the "after" annotation).
  knownBug('L1-A', 'Wealth Add money into a held pocket defaults its source to another account and never checks that account has the money')
  await expect.poll(async () => ({ cib: (await row(page, /^CIB/)).balance, qnb: (await row(page, /^QNB Alahli/)).balance, netWorth: await netWorth(page) }))
    .toEqual({ cib: 5000, qnb: 1000, netWorth: 6000 })
})

test('L3 a pocket deleted from Wealth stays deleted [finding L1-B]', async ({ page, user }) => {
  const [cib] = await seed(page, user.id, 'payment_methods', [bank('CIB', 20000, { opening_at: new Date(Date.now() - 3_600_000).toISOString() })])
  await localMethod(page, cib.id)
  const made = []
  for (const n of ['QA L3 one', 'QA L3 two', 'QA L3 three', 'QA L3 four']) made.push(await newPocket(page, { kind: /^Cash At home/, name: n, amount: 0 }))
  await page.waitForTimeout(3000)
  const results: boolean[] = []
  for (const p of made) results.push((await deletePocket(page, p.name, p.id)).stuck)
  test.info().annotations.push({ type: 'stayed-deleted', description: JSON.stringify(results) })
  // Seen in 5 of 8 runs: the row leaves the store, then comes back within about 200 ms and is never deleted on the
  // server. Four deletes make the defect show in practically every run.
  knownBug('L1-B', 'a pocket deleted from Wealth comes back moments later and is never deleted on the server')
  expect(results).toEqual([true, true, true, true])
  for (const p of made) await serverRows('savings_accounts', user.id, `id=eq.${p.id}&select=deleted_at`, (r: any[]) => !!r[0]?.deleted_at)
})
