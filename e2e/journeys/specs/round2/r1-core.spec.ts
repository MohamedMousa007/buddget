/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped store and PostgREST JSON */
import type { Page } from '@playwright/test'
import { appNav, expect, goto, localState, localWait, signIn, test, tile, moneyIn, netWorth } from '../../lib/fixtures'
import { rows } from '../../lib/admin'
import { serverRows } from '../../lib/server'
import { installApiShim, forceFlags } from '../../lib/apiShim'
import { addAccount, addBorrow, addExpense, addMoneyIn, blur, dialog, payDebt, pickMethod, pickPocket, shown, pickCategory } from '../../lib/ui'

const ERR = /Something went wrong|Application error|Unhandled Runtime Error/i
const qnbTile = (p: Page) => p.getByRole('button', { name: /QNB Alahli/ }).first()
async function withQnb(page: Page, bal: number) {
  await addAccount(page, { kind: 'Bank', provider: /^QNB Alahli/, balance: bal })
  return localWait(page, (s) => s.paymentMethods.find((m: any) => m.name === 'QNB Alahli' && m.openingBalance === bal))
}

test('R01 money in dated today counts in the balance at once, with an exact instant (QA-11)', async ({ page, user }) => {
  const qnb = await withQnb(page, 1000)
  await goto(page, '/flow')
  await addMoneyIn(page, { amount: 500, name: 'QA R01 income', method: /QNB/ })
  const ev = await localWait(page, (s) => s.incomeEvents.find((e: any) => e.name === 'QA R01 income'))
  expect(ev.occurredAt, 'income event carries an exact instant').toBeTruthy()
  const [row] = await serverRows('income_events', user.id, `id=eq.${ev.id}`, (r: any[]) => r.length === 1)
  expect(Number(row.amount)).toBe(500)
  expect(row.payment_method_id).toBe(qnb.id)
  expect(await netWorth(page)).toBe(1500)
  await goto(page, '/accounts')
  await expect(qnbTile(page)).toContainText(shown('1,500'))
})

test('R02 pocket funding is an internal move: Flow shows no income and no spending, net worth unchanged', async ({ page, user }) => {
  await withQnb(page, 2000)
  await goto(page, '/wealth')
  await page.getByRole('button', { name: 'Add pocket', exact: true }).first().click()
  const add = dialog(page, 'Add pocket')
  await add.getByRole('radio', { name: /^Cash At home/ }).click()
  await add.getByRole('button', { name: 'Add pocket', exact: true }).click()
  const form = dialog(page, /^New /)
  await form.getByRole('textbox').first().fill('QA R02 pocket')
  await form.getByRole('textbox', { name: 'Amount' }).fill('0')
  await blur(page)
  await form.getByRole('button', { name: 'Add pocket', exact: true }).click()
  await expect(form).toBeHidden()
  await page.getByRole('button', { name: 'Add money' }).first().click()
  const d = dialog(page, 'Add money')
  await pickPocket(page, d, 'Into', /QA R02 pocket/)
  await d.getByRole('textbox', { name: 'Amount' }).fill('600')
  await blur(page)
  await d.getByRole('button', { name: 'Add money', exact: true }).click()
  await expect(d).toBeHidden()
  await serverRows('savings_transactions', user.id, 'amount=eq.600', (r) => r.length === 1)
  // No income event and no expense row may exist for an internal move.
  expect(await rows('income_events', user.id, 'deleted_at=is.null')).toHaveLength(0)
  expect((await rows('expenses', user.id, 'deleted_at=is.null')).filter((e: any) => e.category !== 'Savings')).toHaveLength(0)
  await goto(page, '/flow')
  expect(await netWorth(page)).toBe(2000)
  expect(await moneyIn(page)).toBe(0)
  const main = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  test.info().annotations.push({ type: 'evidence', description: `flow after funding 600: ${main.slice(0, 300)}` })
  expect(main).not.toMatch(/Spent\s*600/)
})

test('R03 double tap on Save creates one expense (store and server)', async ({ page, user }) => {
  await withQnb(page, 1000)
  await goto(page, '/flow')
  await page.getByRole('button', { name: 'Quick add' }).click()
  await dialog(page, 'Add').getByRole('button', { name: /^Expense/ }).click()
  const d = dialog(page, 'Add expense')
  await d.getByRole('textbox', { name: 'Amount' }).fill('75')
  await d.getByRole('textbox', { name: 'Description' }).fill('QA R03 dup')
  await pickCategory(page, d, 'Food')
  await d.getByRole('button', { name: /^Paid with/ }).click()
  await pickMethod(page, /QNB/)
  await blur(page)
  const save = d.getByRole('button', { name: 'Save expense' })
  await save.dblclick({ delay: 5 }).catch(() => undefined)
  await save.click({ timeout: 1000 }).catch(() => undefined)
  await expect(d).toBeHidden()
  await page.waitForTimeout(2500)
  const st = await localState(page)
  expect(st.expenses.filter((e: any) => e.description === 'QA R03 dup' && !e.deletedAt)).toHaveLength(1)
  await serverRows('expenses', user.id, 'description=eq.QA R03 dup&deleted_at=is.null', (r) => r.length === 1)
  expect(await netWorth(page)).toBe(925)
})

async function deleteThenUndo(page: Page, userId: string, desc: string, reloadFirst: boolean, waitMs = 0) {
  await withQnb(page, 1000)
  await goto(page, '/flow')
  await addExpense(page, { amount: 200, description: desc, category: 'Food', method: /QNB/ })
  const e = await localWait(page, (s) => s.expenses.find((x: any) => x.description === desc))
  await serverRows('expenses', userId, `id=eq.${e.id}`, (r) => r.length === 1)
  if (reloadFirst) { await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('main')).toContainText(desc, { timeout: 30_000 }) }
  await page.getByText(desc).first().click()
  await dialog(page, 'Edit expense').getByRole('button', { name: 'Delete' }).click()
  // Light touch asks first ("Delete this expense? … You can undo right after.").
  const ask = page.getByRole('alertdialog', { name: 'Delete this expense?' })
  await ask.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(ask).toBeHidden()
  const undo = page.getByRole('button', { name: /^Undo/ })
  await expect(undo, 'an undo action is offered after delete').toBeVisible({ timeout: 8000 })
  if (waitMs) { await page.waitForTimeout(waitMs); await expect(undo, 'Undo still on screen').toBeVisible() }
  await undo.click()
  await page.waitForTimeout(5000)
  return e
}

test('R04a delete an expense then undo within a second: one live row, balance restored, server agrees', async ({ page, user }) => {
  const e = await deleteThenUndo(page, user.id, 'QA R04a del', false)
  await expect(page.locator('main')).toContainText('QA R04a del')
  expect(await netWorth(page)).toBe(800)
  const live = await serverRows('expenses', user.id, 'description=eq.QA R04a del&deleted_at=is.null', (r) => r.length === 1)
  expect(live[0].id).toBe(e.id)
  expect(await rows('expenses', user.id, 'description=eq.QA R04a del')).toHaveLength(1)
})

test('R04b delete after a reload, then undo: the expense comes back or the user is told why not (QA-41)', async ({ page, user }) => {
  const e = await deleteThenUndo(page, user.id, 'QA R04b del', true)
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  const server = await rows('expenses', user.id, `id=eq.${e.id}`)
  const live = server.some((r: any) => !r.deleted_at)
  const local = (await localState(page)).expenses.filter((x: any) => x.id === e.id && !x.deletedAt).length
  test.info().annotations.push({ type: 'evidence', description: `after undo: server live=${live}, local live=${local}, ui shows row=${body.includes('QA R04b del')}, notice mentions undo=${/undo|restore|can.t|couldn/i.test(body)}` })
  if (!live) expect(local, 'Undo must not leave a row on screen that the server has deleted').toBe(0)
  expect(live || /couldn.t|can.t|not restored|too late|refus/i.test(body), 'undo silently did nothing: no restore and no message').toBe(true)
})

test('R04c Undo still offered 6 s after delete restores the expense (a visible Undo must work)', async ({ page, user }) => {
  const e = await deleteThenUndo(page, user.id, 'QA R04c del', false, 6000)
  const live = (await rows('expenses', user.id, `id=eq.${e.id}`)).some((r: any) => !r.deleted_at)
  const shown = ((await page.locator('main').innerText()) ?? '').includes('QA R04c del')
  test.info().annotations.push({ type: 'evidence', description: `6 s late undo: server live=${live}, shown=${shown}` })
  expect(live && shown).toBe(true)
})

test('R05 Reports: Biggest purchase skips debt payments; money in shows expected and received', async ({ page, user }) => {
  void user
  await withQnb(page, 5000)
  await goto(page, '/flow')
  await addExpense(page, { amount: 300, description: 'QA R05 shoes', category: 'Shopping', method: /QNB/ })
  await addBorrow(page, { person: 'Ahmed', what: 'QA R05 loan', amount: 3000 })
  await payDebt(page, { debt: 'QA R05 loan', amount: 1500, method: 'QNB Alahli' })
  await goto(page, '/reports')
  const main = page.locator('main')
  // Reports is Insights now: the summary panel sits in the closed "More reports" fold (light touch).
  await main.getByText('More reports', { exact: true }).click()
  await expect(main.getByText(/Biggest purchase/i).first()).toBeVisible()
  const txt = (await main.innerText()).replace(/\s+/g, ' ')
  test.info().annotations.push({ type: 'evidence', description: txt.slice(0, 500) })
  const big = txt.match(/Biggest purchase.*?E£\s*([\d,]+)/i)
  expect(big, 'Reports shows a Biggest purchase figure').not.toBeNull()
  expect(Number(big![1].replace(/,/g, ''))).toBe(300)
  await expect(main.getByText(/Money in|Income/).filter({ visible: true }).first()).toBeVisible()
  expect(txt).toMatch(/expected/i)
  expect(txt).toMatch(/received/i)
})

test('R06 paydays: add salary on the 25th, listed, server row has the day and amount', async ({ page, user }) => {
  await withQnb(page, 100)
  await goto(page, '/paydays')
  // Income (v9): "Add income" is the Sources link, or the empty state's CTA.
  await page.getByRole('button', { name: 'Add income', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Add income source' })
  await d.getByRole('textbox', { name: 'Amount' }).fill('7000')
  await d.getByRole('textbox', { name: 'Name' }).fill('QA R06 Payroll')
  await d.getByRole('button', { name: /^Salary day/ }).click()
  const day = dialog(page, /^Salary day$/)
  await day.getByRole('radio', { name: '25', exact: true }).click()
  await day.getByRole('button', { name: 'Done' }).click()
  await expect(day).toBeHidden()
  await blur(page)
  await d.getByRole('button', { name: 'Add income source' }).click()
  await expect(d).toBeHidden()
  // Income home: the source is a row with its name and amount.
  await expect(page.locator('main')).toContainText(/QA R06 Payroll[\s\S]*7,000\s*EGP/)
  await serverRows('income_sources', user.id, 'name=eq.QA R06 Payroll&deleted_at=is.null', (r: any[]) => r.length === 1 && r[0].day_of_month === 25 && Number(r[0].amount) === 7000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('main')).toContainText(/QA R06 Payroll[\s\S]*7,000\s*EGP/)
})

test('R07 budget: manual builder and budget history open for a new user without errors; Zakat prompt absent when it changes nothing', async ({ page, user }) => {
  void user
  await page.goto('/budget-setup', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Blank' }).click()
  await expect(page.locator('body')).not.toContainText(ERR)
  await page.goto('/budget-history', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /^Back to Budget/ })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('body')).not.toContainText(ERR)
  await goto(page, '/wealth')
  await expect(page.locator('main')).not.toContainText(/zakat/i)
})

test('R08 pages: Notifications, Settings, Security, Profile, Help/feedback render', async ({ page, user }) => {
  void user
  for (const [path, text] of [['/notifications', 'Notifications'], ['/settings', 'Settings'], ['/settings/security', 'Sign-in & security'], ['/settings/profile', 'Profile'], ['/settings/memory', 'Memory']] as const) {
    await goto(page, path)
    await expect(page.getByRole('heading', { name: text }).first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(ERR)
  }
  await goto(page, '/settings/security')
  await page.getByRole('button', { name: /^Your devices/ }).click()
  await expect(page.getByRole('dialog').or(page.locator('main')).first()).toContainText(/device|This device/i)
})

test('R09 feedback: Messages > New message posts one request with device context and opens the thread (mocked, nothing stored)', async ({ page, user }) => {
  void user
  const posts: any[] = []
  await page.route(/\/api\/support\/submit(\?|$)/, async (route) => {
    if (route.request().method() === 'POST') { posts.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, number: 1 }) }) }
    return route.continue()
  })
  await page.route(/\/api\/support\/tickets\/1(\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ticket: { number: 1, subject: 'QA R09 mocked feedback', display_status: 'open', can_reply: true, can_rate: false, csat_rating: null }, messages: [{ id: 'm1', author_type: 'user', author_name: null, body: 'QA R09 mocked feedback', created_at: new Date().toISOString(), attachments: [] }] }),
  }))
  // Feedback lives on Settings > Help & feedback > Messages (support conversations, migration 0346).
  await goto(page, '/settings/help')
  await page.getByRole('button', { name: /^Messages/ }).click()
  const d = page.getByRole('dialog').last()
  await expect(d).toBeVisible()
  await d.getByRole('button', { name: /^New message/ }).first().click()
  await d.getByRole('textbox', { name: 'Subject' }).fill('QA R09 mocked feedback')
  await d.getByRole('button', { name: /^Send message/ }).click()
  await expect.poll(() => posts.length, { timeout: 10_000 }).toBe(1)
  expect(posts[0].context).toMatchObject({ platform: 'web', locale: 'en' })
  await expect(d.getByRole('textbox', { name: 'Write a message' })).toBeVisible()
})

test('R10 Pro, Rewards, Invite, Founders with selling off: no dead loading state, no purchase button', async ({ page }) => {
  const seen: string[] = []
  for (const p of ['/settings/pro', '/settings/rewards', '/settings/invite', '/settings/founders']) {
    await page.goto(p, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(9000)
    const txt = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    seen.push(`${p} -> ${page.url().replace(/^https?:\/\/[^/]+/, '')}: ${txt.slice(0, 160)}`)
    expect(txt, p).not.toMatch(ERR)
    expect(txt, `${p} must not show a perpetual loading state`).not.toMatch(/Loading your plan/)
    expect(txt, `${p} must not offer a purchase while selling is off`).not.toMatch(/Subscribe|Buy now|Upgrade now/i)
  }
  test.info().annotations.push({ type: 'evidence', description: seen.join(' | ') })
})

test('R11 invite link /i/<code> shows the guest pass, saves the code in the 30-day cookie, shows no expiry, and before launch sends a newcomer to the waitlist invite landing with the code; a bad code just opens the app', async ({ page }) => {
  await page.goto('/i/layla-7k2')
  await expect(page.getByText('Code saved for sign-up')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Your guest pass. Tap to flip' })).toBeVisible()
  await expect(page.getByText('Tap the pass to see what you get')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join the waitlist' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'I already have buddget' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/expir|valid until/i)
  const cookie = (await page.context().cookies()).find((c) => c.name === 'buddget_invite')
  expect(cookie?.value).toBe('LAYLA-7K2')
  expect(cookie?.sameSite).toBe('Lax')
  expect((cookie?.expires ?? 0) * 1000 - Date.now()).toBeGreaterThan(29 * 86_400_000)
  await page.getByRole('button', { name: 'Join the waitlist' }).click()
  await expect(page).toHaveURL(/\/en\/waitlist\/invite\?ref=LAYLA-7K2/)
  await page.context().clearCookies()
  await page.goto('/i/!!')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  expect((await page.context().cookies()).some((c) => c.name === 'buddget_invite')).toBe(false)
})

test('R11b invite link: "Join the waitlist" tapped before the page hydrates still leaves for the waitlist invite landing, and the code is kept', async ({ page, context }) => {
  // Hold the app's script back, as a slow phone or a cold server does, so the tap lands on the server-rendered page.
  let hold = true
  await context.route(/\/_next\/static\/chunks\/.*\.js/, async (r) => {
    while (hold) await new Promise((x) => setTimeout(x, 100))
    await r.continue()
  })
  await page.goto('/i/layla-7k2', { waitUntil: 'domcontentloaded' })
  const cookie = (await context.cookies()).find((c) => c.name === 'buddget_invite')
  expect(cookie?.value, 'the proxy keeps the code before any script runs').toBe('LAYLA-7K2')
  expect((cookie?.expires ?? 0) * 1000 - Date.now()).toBeGreaterThan(29 * 86_400_000)
  await page.getByRole('button', { name: 'Join the waitlist' }).click()
  hold = false
  await expect(page).toHaveURL(/\/waitlist\/invite\?ref=LAYLA-7K2/)
  await context.unroute(/\/_next\/static\/chunks\/.*\.js/)
})

test('R12 Quick add lists its entries; scan receipt and voice entry reachable on web (recorded)', async ({ page, user }) => {
  void user
  await goto(page, '/flow')
  await page.getByRole('button', { name: 'Quick add' }).click()
  const names = await dialog(page, 'Add').getByRole('button').allInnerTexts()
  test.info().annotations.push({ type: 'evidence', description: `quick-add entries: ${names.map((n) => n.replace(/\s+/g, ' ').slice(0, 30)).join(' | ')}` })
  expect(names.length).toBeGreaterThanOrEqual(5)
  const scan = dialog(page, 'Add').getByRole('button', { name: /scan|receipt/i })
  const voice = dialog(page, 'Add').getByRole('button', { name: /voice|speak|mic/i })
  test.info().annotations.push({ type: 'evidence', description: `scan entry: ${await scan.count()}, voice entry: ${await voice.count()}` })
})

test('R13 sign out with an unsent edit asks before wiping (QA-65)', async ({ page, context, user }) => {
  await withQnb(page, 1000)
  // The profile menu redesign (b69d8b3a) moved Sign out to the foot of Settings; load it while online, then go offline there.
  await goto(page, '/settings')
  await context.setOffline(true)
  await addExpense(page, { amount: 40, description: 'QA R13 unsent', category: 'Food', method: /QNB/ })
  await localWait(page, (s) => s.expenses.find((x: any) => x.description === 'QA R13 unsent'))
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click()
  const seen: string[] = []
  for (let i = 0; i < 16; i++) {
    const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog')).last()
    if (await dlg.isVisible().catch(() => false)) {
      const t = ((await dlg.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').slice(0, 160)
      if (!seen.includes(t)) seen.push(t)
      const btn = dlg.getByRole('button', { name: /^(Sign out|Sign out anyway)$/ })
      if (await btn.count()) await btn.first().click().catch(() => undefined)
    }
    await page.waitForTimeout(500)
  }
  test.info().annotations.push({ type: 'evidence', description: `dialogs seen: ${JSON.stringify(seen)}` })
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  const stored = await page.evaluate(() => localStorage.getItem('buddget-storage') ?? '')
  const wiped = !stored.includes('QA R13 unsent')
  // The warning is a dialog that closes on "Sign out anyway": what it said is in `seen`, not in the final body.
  const asked = /unsent|not saved|not synced|still waiting|lose|lost/i.test(`${body} ${seen.join(' ')}`)
  test.info().annotations.push({ type: 'evidence', description: `offline sign-out: asked=${asked} wiped=${wiped}; server rows=${(await rows('expenses', user.id, 'description=eq.QA R13 unsent')).length}` })
  // Money rule: an unsent expense may only be wiped after the user was asked.
  expect(wiped && !asked, 'unsent expense wiped with no warning').toBe(false)
})

const isRestWrite = (method: string, url: string) => method !== 'GET' && method !== 'HEAD' && /\/rest\/v1\/(?!rpc\/)/.test(url)

test('R16 S7a: when the server refuses every write the user sees "not saved", and the retry lands it once the server is back', async ({ page, user }) => {
  await withQnb(page, 1000)
  await goto(page, '/flow')
  await page.route(/\/rest\/v1\//, (route) => (isRestWrite(route.request().method(), route.request().url())
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"qa forced failure"}' })
    : route.fallback()))
  await addExpense(page, { amount: 60, description: 'QA R16 refused', category: 'Food', method: /QNB/ })
  await expect(page.getByText(/not saved/i).first(), 'a refused save must say so on screen').toBeVisible({ timeout: 15_000 })
  await page.unroute(/\/rest\/v1\//)
  // D-4: the backoff retries on its own, no further edit needed.
  await serverRows('expenses', user.id, 'description=eq.QA R16 refused&deleted_at=is.null', (r) => r.length === 1, 45_000)
  await expect(page.getByText(/not saved/i)).toHaveCount(0, { timeout: 15_000 })
})

test('R17 S8d-6: a reload with no edit sends no writes', async ({ page, user }) => {
  await withQnb(page, 1000)
  await goto(page, '/flow')
  await addExpense(page, { amount: 15, description: 'QA R17 seed', category: 'Food', method: /QNB/ })
  await serverRows('expenses', user.id, 'description=eq.QA R17 seed&deleted_at=is.null', (r) => r.length === 1)
  await page.waitForTimeout(4000)
  const writes: string[] = []
  page.on('request', (r) => {
    if (!isRestWrite(r.method(), r.url())) return
    const table = new URL(r.url()).pathname.split('/').pop()
    let keys = ''
    try { const b = r.postDataJSON(); keys = Object.keys(Array.isArray(b) ? b[0] ?? {} : b ?? {}).sort().join('|') } catch { /* no body */ }
    writes.push(`${r.method()} ${table} [${keys}] ${(r.postData() ?? '').slice(0, 700)}`)
  })
  page.on('response', async (res) => {
    if (!isRestWrite(res.request().method(), res.url())) return
    writes.push(`  -> ${res.status()} ${new URL(res.url()).pathname.split('/').pop()} ${(await res.text().catch(() => '')).slice(0, 300)}`)
  })
  const boot: string[] = []
  await page.context().addInitScript((uid) => {
    (window as any).__qaBoot = { fp: localStorage.getItem(`buddget:flushed:${uid}`), store: localStorage.getItem('buddget-storage') }
  }, user.id)
  for (let i = 0; i < 2; i++) {
    // What the next boot diffs against: the stored fingerprint and the persisted rows (synthetic user, no personal data).
    await page.reload({ waitUntil: 'domcontentloaded' })
    // Read what the app booted on: copied by an init script before any app code ran.
    boot.push(await page.evaluate((uid) => {
      const b = (window as any).__qaBoot ?? {}
      const raw = b.fp as string | null
      const fp = raw ? JSON.parse(raw) : null
      const st = JSON.parse(b.store ?? '{}').state ?? {}
      // Same hash as src/components/sync/flushedFingerprint.ts: which cached rows the next boot will see as unsent.
      const stable = (value: unknown): string => {
        if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
        if (value && typeof value === 'object') { const o = value as Record<string, unknown>; return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}` }
        return JSON.stringify(value) ?? 'null'
      }
      const hash = (value: unknown) => {
        const t = stable(value); let h1 = 0x811c9dc5; let h2 = 0x9747b28c
        for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 15 }
        return `${t.length.toString(36)}.${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`
      }
      const mismatch: string[] = []
      for (const [k, v] of Object.entries(fp?.singles ?? {})) if (v !== hash(st[k])) mismatch.push(`single ${k}`)
      for (const [k, rowsByHash] of Object.entries(fp?.lists ?? {})) for (const r of (st[k] ?? []) as any[]) {
        const known = (rowsByHash as Record<string, string>)[r.id]
        if (known === undefined) mismatch.push(`${k} ${r.id} not in fingerprint`)
        else if (known !== hash(r)) mismatch.push(`${k} ${r.id} hash differs`)
      }
      return JSON.stringify({
        mismatch,
        fp: fp && { v: fp.v, singles: Object.keys(fp.singles ?? {}), lists: Object.fromEntries(Object.entries(fp.lists ?? {}).map(([k, v]) => [k, Object.keys(v as object)])) },
        cache: { profileId: st.profile?.id, paymentMethods: (st.paymentMethods ?? []).map((m: any) => m.id), expenses: (st.expenses ?? []).map((e: any) => e.id) },
        store: { profile: st.profile, settings: st.settings, paymentMethods: st.paymentMethods, expenses: st.expenses },
      }).slice(0, 6000)
    }, user.id))
    await expect(page.locator('main')).toContainText('QA R17 seed', { timeout: 30_000 })
    await page.waitForTimeout(8000)
  }
  test.info().annotations.push({ type: 'evidence', description: `writes on reload: ${JSON.stringify(writes)}` })
  test.info().annotations.push({ type: 'evidence', description: `state each boot started from: ${JSON.stringify(boot)}` })
  expect(writes, 'writes on a reload without an edit').toEqual([])
})

test.describe('two devices', () => {
  test('R14 two devices: add, offline add, offline delete, reconnect; nothing lost, duplicated or revived', async ({ page, browser, user }) => {
    await withQnb(page, 3000)
    await goto(page, '/flow')
    await addExpense(page, { amount: 100, description: 'QA R14 from A', category: 'Food', method: /QNB/ })
    const a1 = await localWait(page, (s) => s.expenses.find((x: any) => x.description === 'QA R14 from A'))
    await serverRows('expenses', user.id, `id=eq.${a1.id}`, (r) => r.length === 1)

    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: process.env.QA_BASE ?? 'http://localhost:3100', bypassCSP: true, timezoneId: 'Africa/Cairo', locale: 'en-US' })
    try {
      await installApiShim(ctxB); await forceFlags(ctxB, { onboarding_v1: false })
      const B = await ctxB.newPage()
      await signIn(B, user.email)
      await goto(B, '/flow')
      await expect(B.locator('main')).toContainText('QA R14 from A', { timeout: 30_000 })
      // The list can show A's expense a moment before the Net worth tile recomputes: poll the tile.
      await expect.poll(() => netWorth(B), { timeout: 15_000 }).toBe(2900)
      // Net worth lives on Accounts now: back to Flow while still online (a navigation would fail offline).
      await goto(B, '/flow')
      await expect(B.locator('main')).toContainText('QA R14 from A')

      // B goes offline, adds an expense and deletes A's.
      await ctxB.setOffline(true)
      await addExpense(B, { amount: 50, description: 'QA R14 from B', category: 'Transport', method: /QNB/ })
      await B.getByText('QA R14 from A').first().click()
      await dialog(B, 'Edit expense').getByRole('button', { name: 'Delete' }).click()
      const c = B.getByRole('alertdialog').getByRole('button', { name: /^(Delete|Yes, delete|Confirm)/ })
      if (await c.isVisible({ timeout: 2500 }).catch(() => false)) await c.click()
      // Meanwhile A edits the same row it is about to lose.
      await page.getByText('QA R14 from A').first().click()
      await dialog(page, 'Edit expense').getByRole('textbox', { name: 'Description' }).fill('QA R14 from A edited')
      await blur(page)
      await dialog(page, 'Edit expense').getByRole('button', { name: 'Save changes' }).click()
      await serverRows('expenses', user.id, `id=eq.${a1.id}`, (r: any[]) => r[0]?.description === 'QA R14 from A edited')

      await ctxB.setOffline(false)
      await B.reload({ waitUntil: 'domcontentloaded' })
      await expect.poll(async () => (await rows('expenses', user.id, 'description=eq.QA R14 from B&deleted_at=is.null')).length, { timeout: 40_000 }).toBe(1)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      const all = await rows('expenses', user.id, 'order=created_at')
      const live = all.filter((e: any) => !e.deleted_at)
      const evidence = all.map((e: any) => `${e.description}:${e.deleted_at ? 'deleted' : 'live'}`).join(', ')
      test.info().annotations.push({ type: 'evidence', description: `server after reconnect: ${evidence}` })
      expect(live.filter((e: any) => e.description === 'QA R14 from B')).toHaveLength(1)
      // Both devices must now agree on the same set of live expenses and the same net worth.
      // Both devices must converge on the server's live set. A reload's reconcile (flush, then pull) can take longer than
      // a fixed wait on the dev server, so poll; a device that never converges within the window is a real defect.
      const want = live.map((e: any) => e.id).sort()
      const ids = async (p: typeof page) => (await localState(p)).expenses.filter((e: any) => !e.deletedAt).map((e: any) => e.id).sort()
      let sa: string[] = []; let sb: string[] = []
      await expect.poll(async () => { sa = await ids(page); sb = await ids(B); return JSON.stringify([sa, sb]) }, { timeout: 40_000 }).toBe(JSON.stringify([want, want]))
      test.info().annotations.push({ type: 'evidence', description: `converged: A=${sa.join(',')} B=${sb.join(',')} server=${want.join(',')}` })
      await goto(page, '/flow'); await goto(B, '/flow')
      const nwA = await netWorth(page)
      await expect.poll(() => netWorth(B), { timeout: 15_000 }).toBe(nwA)
    } finally { await ctxB.close() }
  })

  test('R15 two tabs of one device: an expense added in tab 1 appears in tab 2 and is not duplicated', async ({ page, context, user }) => {
    await withQnb(page, 1000)
    await goto(page, '/flow')
    const tab2 = await context.newPage()
    await goto(tab2, '/flow')
    await addExpense(page, { amount: 20, description: 'QA R15 tab1', category: 'Food', method: /QNB/ })
    await serverRows('expenses', user.id, 'description=eq.QA R15 tab1&deleted_at=is.null', (r) => r.length === 1)
    await tab2.reload({ waitUntil: 'domcontentloaded' })
    await expect(tab2.locator('main')).toContainText('QA R15 tab1', { timeout: 20_000 })
    await addExpense(tab2, { amount: 30, description: 'QA R15 tab2', category: 'Food', method: /QNB/ })
    await serverRows('expenses', user.id, 'description=like.QA R15*&deleted_at=is.null', (r) => r.length === 2)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('QA R15 tab2', { timeout: 20_000 })
    expect(await netWorth(page)).toBe(950)
    void appNav
  })
})
