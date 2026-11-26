import type { BrowserContext } from '@playwright/test'

/**
 * The shared dev server is built with NEXT_PUBLIC_API_BASE_URL=https://buddget.app (the native setting), so on
 * localhost the client sends every /api call cross-origin to production, which the CSP refuses (E2E-ENV-01).
 * Tests run with bypassCSP and this shim sends those calls to the local server under test instead, adding the
 * CORS headers a real cross-origin API would send. No request ever reaches buddget.app.
 */
export const LOCAL = process.env.QA_BASE ?? 'http://localhost:3100'
export async function installApiShim(ctx: BrowserContext) {
  await isolateEmailCheck(ctx)
  await ctx.route(/^https:\/\/(www\.)?buddget\.app\/api\//, async (route) => {
    const req = route.request()
    const origin = req.headers()['origin'] ?? LOCAL
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = req.url().replace(/^https:\/\/(www\.)?buddget\.app/, LOCAL)
    // Awaited inside the try: a page that navigates away mid-request disposes the response, and an un-awaited
    // fulfill would reject outside this catch and fail the test (Q6 under parallel load).
    try {
      const res = await route.fetch({ url, timeout: 60_000 })
      return await route.fulfill({ response: res, headers: { ...res.headers(), ...cors } })
    } catch {
      return route.abort('failed').catch(() => undefined)
    }
  })
}

/** Forces feature flags for the test user (onboarding_v1 is a 10% rollout, so a fresh account rarely sees it). */
export async function forceFlags(ctx: BrowserContext, flags: Record<string, boolean>) {
  await ctx.route(/\/api\/flags(\?|$)/, async (route) => {
    let base: Record<string, boolean> = {}
    try {
      const url = route.request().url().replace(/^https:\/\/(www\.)?buddget\.app/, LOCAL)
      const res = await route.fetch({ url })
      if (res.ok()) base = ((await res.json()) as { flags: Record<string, boolean> }).flags ?? {}
    } catch { /* fall through */ }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': route.request().headers()['origin'] ?? LOCAL, 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ flags: { ...base, ...flags } }),
    })
  })
}

/**
 * Every journey signs in through the email-first modal, which asks `/api/auth/check-email`; that route caps each address at
 * 300 a day (QA-99). All suites run from one machine, so a full run plus re-runs exhausts the cap and a sign-up then reads
 * as "Welcome back" (A1). Give each browser context its own rate bucket on that one route via `x-real-ip` (the platform
 * header the route trusts). This isolates the journeys from the limit; the limit itself is covered by the API suites.
 */
export async function isolateEmailCheck(ctx: BrowserContext) {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
  await ctx.route(/\/api\/auth\/check-email(\?|$)/, (route) => route.continue({ headers: { ...route.request().headers(), 'x-real-ip': ip } }))
}
