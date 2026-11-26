/** Browser setup and click helpers shared by the light-touch capture script. */
import { chromium } from 'playwright-core'
import { seedInPage } from './light-touch-seed.mjs'

export const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const VIEWPORT = { width: 390, height: 844 }

/** Dev-only overlays that are not part of the app UI. */
const HIDE_DEV_CSS = 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }'

export async function launch() {
  return chromium.launch({ channel: 'chrome' })
}

/**
 * A phone context. `offline` fakes navigator.onLine=false: with empty Supabase env, useAccountGaps
 * calls createClient() when online and the Accounts page hits its error boundary.
 */
export async function phoneContext(browser, { storageState, offline = false } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState, timezoneId: 'Africa/Cairo', locale: 'en-US' })
  if (offline) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }))
  await ctx.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = css
      document.head.appendChild(s)
    })
  }, HIDE_DEV_CSS)
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  return { ctx, page }
}

/** Navigate and wait for the bypass stores and dataReady; retries while the dev server recompiles. */
export async function go(page, route) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 180_000 })
      await page.waitForFunction(() => window.__finance?.getState().dataReady && window.__qa, null, { timeout: 180_000 })
      break
    } catch (e) {
      if (attempt >= 3) throw e
      await page.waitForTimeout(5000)
    }
  }
  // Environment pills (fake offline, no gold feed without Supabase): hide them the way a user swipes them away.
  await page.evaluate(() => {
    const until = new Date(Date.now() + 3_600_000).toISOString()
    for (const key of ['offline', 'gold-prices', 'sync']) window.__settings?.getState().hideStatus?.(key, until)
  })
  await settle(page)
}

export async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

/** Seeds a fresh context and returns its storage state, so later contexts start with the same data. */
export async function seededState(browser, { seed = true, plan = 'active', mutate } = {}) {
  const { ctx, page } = await phoneContext(browser, { offline: true })
  await go(page, '/flow')
  if (seed) await page.evaluate(seedInPage)
  if (mutate) await page.evaluate(mutate)
  await page.evaluate((p) => window.__qa.plan(p), plan)
  await page.waitForTimeout(600)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(300)
  const state = await ctx.storageState()
  await ctx.close()
  return state
}

/** Click the first visible element matching a label: aria-label, role name, or text. */
export async function tap(page, label, { exact = false, nth = 0 } = {}) {
  const candidates = typeof label === 'string' && label.startsWith('css=')
    ? [page.locator(label.slice(4))]
    : [
        page.locator(`[aria-label="${label}"]`),
        page.getByRole('button', { name: label, exact }),
        page.getByRole('tab', { name: label, exact }),
        page.getByRole('link', { name: label, exact }),
        page.getByText(label, { exact }),
      ]
  for (const loc of candidates) {
    const visible = loc.locator('visible=true')
    if ((await visible.count()) > nth) {
      await visible.nth(nth).click()
      await settle(page, 900)
      return
    }
  }
  throw new Error(`nothing to tap: ${label}`)
}

/** Visible clickable labels, for exploring. */
export async function dump(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button,a,[role=button],[role=tab],[role=switch]')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight })
      .map((e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40))
      .filter(Boolean),
  )
}
