/* eslint-disable @typescript-eslint/no-explicit-any -- in-page globals */
import { test } from '@playwright/test'
import { PASSWORD } from '../../journeys/lib/admin'
import { instrument, readUsers, settle, throttle, writeJson } from '../lib'

/** QA-84 re-profile: React commits from the Sign me in click until the app has been quiet for 3 s, large user, CPU 4x + Fast 4G, 390 px. */
for (let run = 1; run <= 3; run++) {
  test(`commits large run ${run}`, async ({ browser }) => {
    const u = readUsers().large
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'en-US', timezoneId: 'Africa/Cairo', bypassCSP: true })
    await instrument(ctx, { commits: true, attribute: true })
    const page = await ctx.newPage()
    await throttle(page)
    await page.goto('/flow', { waitUntil: 'domcontentloaded' })
    await page.getByRole('textbox', { name: 'Email' }).fill(u.email)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD)
    const before = await page.evaluate(() => (window as any).__perf.commits as number)
    await page.getByRole('button', { name: 'Sign me in' }).click()
    await page.getByRole('button', { name: /^Profile menu/ }).waitFor({ timeout: 120000 })
    await page.waitForFunction(() => { const r = localStorage.getItem('buddget-storage'); return !!r && !!JSON.parse(r).state?.profile?.id }, null, { timeout: 120000 })
    await settle(page, 3000, 40000)
    const p = await page.evaluate(() => (window as any).__perf)
    const top = Object.entries(p.comp as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 25)
    writeJson(`commits-large-${run}.json`, { total: p.commits, beforeSignInClick: before, sinceSignInClick: p.commits - before, topComponentsByRenders: top, perSecond: (() => { const b: Record<number, number> = {}; for (const t of p.commitTimes as number[]) { const k = Math.floor(t / 1000); b[k] = (b[k] ?? 0) + 1 } return b })() })
    await ctx.close()
  })
}
