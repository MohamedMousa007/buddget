// S8g browser journeys: each state on its screens (Free/new, trial, Pro at a tier, lapsed Elite, founder), the PRO tag and tier
// badge in Settings, the points shop with a double tap, invite copy/share and the /i/ deep link, buy buttons tapped twice, and
// the error states (a 500 on /api/entitlements/me, a failed invite list, offline).
import { test, expect, signInUi, openLoaded } from './fixture'
import { account, freeFounderNumber, PRO_ACTIVE, PRO_LAPSED, rpc, setEntitlement, setLoyalty, svc } from '../../../../api/round2/pro-rewards/lib'

const main = (page: import('@playwright/test').Page) => page.locator('main')

test('J1 S8G-02 a brand-new account sees its Silver card on Rewards, not "Rewards are resting"', async ({ page, qa }) => {
  test.fail(true, 'S8G-02 open: no loyalty row for new accounts, so the page says rewards are resting')
  const u = await qa('j1')
  await signInUi(page, u.email)
  await openLoaded(page, '/settings/rewards')
  await expect(main(page).getByText(/Rewards are resting/)).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: /rewards card, Silver tier/ })).toBeVisible()
})

test('J2 @desktop Pro at Diamond: PRO tag and Diamond badge in Settings and on the cards; lapsed with 1,500 shows Elite locked; Pro back shows Elite', async ({ page, qa }) => {
  const u = await qa('j2')
  // Sign in as Free first so the app's automatic trial claim is used up (otherwise a lapsed Pro member is put on a trial, S8G-03).
  await signInUi(page, u.email)
  await expect.poll(async () => (await svc(`trial_claims?user_id=eq.${u.id}&select=user_id`)).json.length, { timeout: 60_000 }).toBe(1)
  await setLoyalty(u.id, { lifetime_points: 900, points_balance: 900, tier_key: 'diamond', gifted_rank: 2 })
  await setEntitlement(u.id, PRO_ACTIVE())
  await openLoaded(page, '/settings')
  await expect(main(page).getByText('PRO', { exact: true }).first()).toBeVisible()
  await expect(main(page).getByText(/Diamond · tier 3 of 5/)).toBeVisible()
  await openLoaded(page, '/settings/rewards')
  await expect(main(page).getByRole('button', { name: /rewards card, Diamond tier/ })).toBeVisible()
  await expect(main(page).getByText('900').first()).toBeVisible()
  await openLoaded(page, '/settings/pro/usage')
  await expect(main(page).getByText(/20%/).first()).toBeVisible()
  // Lapse with Elite points: the server holds Diamond, the card shows Elite locked.
  await setLoyalty(u.id, { lifetime_points: 1600, points_balance: 1600 })
  await setEntitlement(u.id, PRO_LAPSED())
  await openLoaded(page, '/settings/rewards')
  await expect(main(page).getByRole('button', { name: /rewards card, Elite tier/ })).toBeVisible()
  expect((await account(u.id)).tier_key).toBe('diamond')
  await openLoaded(page, '/settings')
  await expect(main(page).getByText(/Diamond · tier 3 of 5/)).toBeVisible()
  await setEntitlement(u.id, PRO_ACTIVE())
  await openLoaded(page, '/settings')
  await expect(main(page).getByText(/Elite · tier 4 of 5/)).toBeVisible()
})

test('J3 a founder opens the Founders club with their number; a non-founder is sent back to Settings', async ({ page, qa }) => {
  const u = await qa('j3')
  await signInUi(page, u.email)
  await page.goto('/settings/founders')
  await expect(page).toHaveURL(/\/settings$/, { timeout: 60_000 })
  const n = await freeFounderNumber()
  await svc('founders', { method: 'POST', body: JSON.stringify({ number: n, user_id: u.id, cohort: 'public', qualified_at: new Date().toISOString() }) })
  await page.goto('/settings/founders')
  await expect(main(page).getByText(new RegExp(`#0*${n}\\b`)).first()).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/\/settings\/founders$/)
})

test('J4 @desktop points shop: a double tap on "Use points" buys one freeze; the next tap explains the points needed', async ({ page, qa }) => {
  const u = await qa('j4')
  await setLoyalty(u.id, { lifetime_points: 80, points_balance: 80, tier_key: 'silver' })
  await signInUi(page, u.email)
  await openLoaded(page, '/settings/rewards')
  await main(page).getByRole('button', { name: /A streak freeze/ }).click()
  const use = page.getByRole('button', { name: 'Use points' })
  await use.dblclick()
  await expect(main(page).getByText('A freeze is added.')).toBeVisible()
  expect(await account(u.id)).toMatchObject({ points_balance: 0, freezes_banked: 1 })
  await main(page).getByRole('button', { name: /A streak freeze/ }).click()
  await expect(main(page).getByText(/You need 80 more points/)).toBeVisible()
  const led = (await svc(`loyalty_ledger?user_id=eq.${u.id}&delta=lt.0&select=delta`)).json
  expect(led.length).toBe(1)
})

test('J5 @desktop invite: Copy link copies the link and says Copied; Share hands the link to the share sheet; an /i/ link is redeemed after sign-in', async ({ page, context, qa }) => {
  const inviter = await qa('j5i')
  const code = (await rpc(inviter.token, 'referral_my_summary')).json.code as string
  const friend = await qa('j5f')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3100' })
  await page.addInitScript(() => { (window as unknown as { __shared: unknown[] }).__shared = []; (navigator as unknown as { share: unknown }).share = async (d: unknown) => { (window as unknown as { __shared: unknown[] }).__shared.push(d) } })
  // Deep link first, signed out: the code waits in a cookie until the account exists.
  const r = await page.goto(`/i/${code.toLowerCase()}`)
  expect(r?.url()).toContain('/flow')
  await signInUi(page, friend.email)
  await expect.poll(async () => (await svc(`referrals?invitee_id=eq.${friend.id}&select=inviter_id`)).json?.[0]?.inviter_id ?? null, { timeout: 60_000 }).toBe(inviter.id)
  await openLoaded(page, '/settings/invite')
  await main(page).getByRole('button', { name: 'Copy link' }).click()
  await expect(main(page).getByRole('button', { name: 'Copied' })).toBeVisible()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toMatch(/^https:\/\/buddget\.app\/i\/[A-Z0-9]+-[A-Z0-9]+$/)
  await main(page).getByRole('button', { name: 'Share your invite' }).dblclick()
  const shared = await page.evaluate(() => (window as unknown as { __shared: Array<{ url: string; text: string }> }).__shared)
  expect(shared.length).toBeGreaterThan(0)
  expect(shared[0].url).toBe(clip)
  expect(shared[0].text).toContain(clip)
})

test('J6 buy buttons tapped twice fail gracefully on the web: one "not yet" note, no crash, no purchase row', async ({ page, qa }) => {
  const u = await qa('j6')
  await signInUi(page, u.email)
  await openLoaded(page, '/settings/pro/usage')
  await main(page).getByRole('button', { name: /Get 650 Sparks/ }).dblclick()
  await expect(main(page).getByText(/can’t be bought on this device yet|not available/i).first()).toBeVisible()
  await openLoaded(page, '/settings/pro')
  await main(page).getByRole('button', { name: 'Keep Pro', exact: true }).dblclick()
  await expect(main(page).getByRole('heading', { name: 'Plan and billing' })).toBeVisible()
  await expect(main(page).getByText(/not available|yet/i).first()).toBeVisible()
  expect((await svc(`spark_purchases?user_id=eq.${u.id}&select=id`)).json).toEqual([])
})

test('J7 errors: a failed invite list offers Try again and recovers', async ({ page, qa }) => {
  const u = await qa('j7')
  await signInUi(page, u.email)
  let fail = true
  await page.route(/\/rest\/v1\/rpc\/referral_my_summary/, (route) => (fail ? route.fulfill({ status: 500, body: '{"message":"boom"}' }) : route.continue()))
  await openLoaded(page, '/settings/invite')
  await expect(main(page).getByText('Couldn’t load your invites. Try again.')).toBeVisible()
  fail = false
  await main(page).getByRole('button', { name: 'Try again' }).click()
  await expect(main(page).getByText('Couldn’t load your invites. Try again.')).toHaveCount(0)
})

test('J8 S8G-07 a 500 (or offline) on /api/entitlements/me shows a message and a retry, not an endless skeleton', async ({ page, qa }) => {
  test.fail(true, 'S8G-07 open: billingStore.refresh keeps me=null on a failed read, so the four pages stay on the skeleton with no message')
  const u = await qa('j8')
  await signInUi(page, u.email)
  await page.route(/\/api\/entitlements\/me/, (route) => route.fulfill({ status: 500, body: '{"error":"boom"}' }))
  await page.goto('/settings/rewards', { waitUntil: 'domcontentloaded' })
  await expect(main(page).getByRole('heading', { name: 'Rewards' })).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: test.info().outputPath('s8g-08-rewards-500.png') })
  await expect(main(page).locator('.animate-pulse')).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: /try again|retry/i })).toBeVisible()
})

test('J9 S8G-03 a lapsed Pro member who never had a trial is put on a 30-day trial just by opening the app', async ({ page, qa }) => {
  test.fail(true, 'S8G-03 open: the app claims the trial on every session start and trial_claim accepts an expired paid plan')
  const u = await qa('j9')
  await setEntitlement(u.id, PRO_LAPSED())
  await signInUi(page, u.email)
  await openLoaded(page, '/settings')
  await page.waitForTimeout(5000)
  const e = (await svc(`user_entitlements?user_id=eq.${u.id}&select=plan_key,status`)).json[0]
  expect(e).toEqual({ plan_key: 'plus', status: 'expired' })
})
