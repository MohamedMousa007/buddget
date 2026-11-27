/* eslint-disable @typescript-eslint/no-explicit-any -- in-page globals */
import { test, expect, type Page } from '@playwright/test'
import { PASSWORD } from '../../journeys/lib/admin'
import { addExpenseFast, openProfileLink } from '../steps'
import { instrument, longTaskMs, median, netLog, readUsers, settle, summarizeNet, throttle, writeJson } from '../lib'

const RUNS = 3
const pm = (page: Page) => page.evaluate(() => (window as any).__perf)
type M = Record<string, number>

/** pointerdown -> last DOM mutation of the burst that follows (ms, in-page clock), plus long-task time in that window. */
async function timed(page: Page, name: string, m: M, net: ReturnType<typeof netLog>, action: () => Promise<void>, ready?: () => Promise<void>) {
  net.step = name
  await page.evaluate(() => { (window as any).__perf.pointer = 0 })
  const t0 = await page.evaluate(() => performance.now())
  await action()
  if (ready) await ready()
  const last = await settle(page, 700)
  const p = await pm(page)
  const start = p.pointer || t0
  m[`${name}_ms`] = Math.round(last - start)
  m[`${name}_longtask_ms`] = await longTaskMs(page, start, last)
  await net.quiet(1200, 10000)
}

for (const who of ['small', 'large'] as const) {
  for (let run = 1; run <= RUNS; run++) {
    test(`journey ${who} run ${run}`, async ({ browser }) => {
      const u = readUsers()[who]
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'en-US', timezoneId: 'Africa/Cairo', bypassCSP: true })
      await instrument(ctx)
      const page = await ctx.newPage()
      const cdp = await throttle(page)
      const net = netLog(page)
      const m: M = {}
      await cdp.send('Network.clearBrowserCache').catch(() => undefined)

      // 1. cold load of the signed-out entry (first useful paint = FCP, plus the sign-in form being usable)
      net.step = 'cold_load_signed_out'
      const tNav = Date.now()
      await page.goto('/flow', { waitUntil: 'commit' })
      await page.getByRole('textbox', { name: 'Email' }).waitFor({ timeout: 120000 })
      m.cold_signedout_form_ready_ms = Date.now() - tNav
      const p0 = await pm(page)
      m.cold_signedout_fcp_ms = Math.round(p0.fcp); m.cold_signedout_lcp_ms = Math.round(p0.lcp)
      await net.quiet(1500, 10000)

      // 2. sign-in -> Flow with data
      net.step = 'signin_to_flow'
      await page.getByRole('textbox', { name: 'Email' }).fill(u.email)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
      const tSign = Date.now()
      await page.getByRole('button', { name: 'Sign me in' }).click()
      await page.getByRole('button', { name: /^Profile menu/ }).waitFor({ timeout: 120000 })
      m.signin_to_shell_ms = Date.now() - tSign
      await expect.poll(async () => page.evaluate(() => { const r = localStorage.getItem('buddget-storage'); return r ? JSON.parse(r).state?.profile?.id ?? null : null }), { timeout: 120000 }).not.toBeNull()
      m.signin_to_synced_ms = Date.now() - tSign
      const last = await settle(page, 1000, 30000)
      m.signin_to_settled_ms = Math.round(last - (await pm(page)).pointer)
      m.signin_longtask_ms = await longTaskMs(page, (await pm(page)).pointer, last)
      await net.quiet(2000, 20000)

      // 3. warm reload of Flow (signed in, cached store): the cold-start path a returning user takes
      net.step = 'reload_signed_in'
      const tR = Date.now()
      await page.reload({ waitUntil: 'commit' })
      await page.getByRole('button', { name: /^Profile menu/ }).waitFor({ timeout: 120000 })
      m.reload_to_shell_ms = Date.now() - tR
      const p1 = await pm(page)
      m.reload_fcp_ms = Math.round(p1.fcp); m.reload_lcp_ms = Math.round(p1.lcp)
      await settle(page, 1000, 30000); await net.quiet(2000, 20000)

      const nav = page.getByRole('navigation').filter({ has: page.getByRole('link', { name: 'Accounts', exact: true }) }).first()
      // 4. tab switches
      for (const [tab, mark] of [['Accounts', /accounts/i], ['Savings', /wealth/i], ['Debts', /debts/i], ['Flow', /flow/i]] as const) {
        await timed(page, `tab_${tab.toLowerCase()}`, m, net, async () => { await nav.getByRole('link', { name: tab, exact: true }).click() }, async () => { await expect(page.locator('main')).toBeVisible(); void mark })
      }
      // 5. Reports (profile menu) and Wealth again via the tab
      await timed(page, 'reports', m, net, async () => { await openProfileLink(page, 'Insights') })
      await timed(page, 'wealth', m, net, async () => { await nav.getByRole('link', { name: 'Savings', exact: true }).click() })
      await timed(page, 'back_to_flow', m, net, async () => { await nav.getByRole('link', { name: 'Flow', exact: true }).click() })
      // 6. add-expense sheet open, then save
      await timed(page, 'open_add_sheet', m, net, async () => {
        await page.getByRole('button', { name: 'Quick add' }).click()
        await page.getByRole('dialog', { name: 'Add' }).getByRole('button', { name: /^Expense/ }).click()
      }, async () => { await page.getByRole('dialog', { name: 'Add expense' }).waitFor() })
      await addExpenseFast(page, m, net, `perf ${who} ${run}`)

      writeJson(`journey-${who}-${run}.json`, { metrics: m, net: summarizeNet(net.log), requests: net.log.filter((r) => !['static', 'thirdparty', 'document'].includes(r.kind)).map((r) => ({ step: r.step, method: r.method, url: r.url.replace(/^https:\/\/[^/]+/, ''), status: r.status, bytes: r.bytes })) })
      await ctx.close()
      expect(median([1])).toBe(1)
    })
  }
}
