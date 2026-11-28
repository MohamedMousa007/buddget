/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures call use() */
// S8g browser fixture: a fresh synthetic user (qa-e2e-pr-*) per test, its state set with service-role writes to its own rows,
// signed in through the UI. Deleted with the extra non-cascading rows afterwards (see e2e/api/round2/pro-rewards/lib.ts dropUser).
import { test as base, expect, type Page } from '@playwright/test'
import { forceFlags, installApiShim } from '../../../lib/apiShim'
import { BASE, dropUser, makeUser, PW, SB_KEY, SB_URL, type QaUser } from '../../../../api/round2/pro-rewards/lib'

export const test = base.extend<{ shim: void; qa: (tag: string) => Promise<QaUser> }>({
  shim: [async ({ context }, use) => {
    await installApiShim(context)
    await context.addInitScript(() => {
      const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s))
    })
    await forceFlags(context, { onboarding_v1: false })
    await use()
  }, { auto: true }],
  qa: async ({}, use) => {
    const made: QaUser[] = []
    await use(async (tag) => { const u = await makeUser(tag); made.push(u); return u })
    for (const u of made) await dropUser(u).catch(() => undefined)
  },
})
export { expect }

/** A deployed preview (QA_BASE not localhost): never type a password into the hosted page (CLAUDE.md, preview rule). */
const HOSTED = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)

/**
 * Hosted runs: sign in through the auth API and let @supabase/ssr write its own auth cookies into the browser context
 * (name, encoding and chunking exactly as the app reads them), then load /flow signed in.
 */
async function signInWithCookie(page: Page, email: string) {
  const { createServerClient } = await import('@supabase/ssr')
  const jar: { name: string; value: string }[] = []
  const sb = createServerClient(SB_URL, SB_KEY, { cookies: { getAll: () => [], setAll: (list) => { for (const c of list) jar.push(c) } } })
  const { error } = await sb.auth.signInWithPassword({ email, password: PW })
  if (error || !jar.length) throw new Error(`cookie sign-in failed: ${error?.message ?? 'no cookies written'}`)
  await page.context().addCookies(jar.filter((c) => c.value).map((c) => ({ name: c.name, value: c.value, url: BASE, sameSite: 'Lax' as const, secure: BASE.startsWith('https') })))
  await page.goto('/flow', { waitUntil: 'domcontentloaded' })
}

/** Signs a synthetic user in: through the form on a local dev server, with an API session cookie on a hosted preview. */
export async function signInUi(page: Page, email: string) {
  if (HOSTED) return finishSignIn(page, () => signInWithCookie(page, email))
  await page.goto('/flow', { waitUntil: 'domcontentloaded' })
  // The dev server sometimes serves a blank first paint while it compiles; reload once if the form is not there.
  if (!(await page.getByRole('textbox', { name: 'Email' }).isVisible({ timeout: 30_000 }).catch(() => false))) await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: 'Email' }).fill(email, { timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'Password' }).fill(PW)
  await page.getByRole('button', { name: 'Sign me in' }).click()
  await finishSignIn(page)
}

/** Proof the session is real before a test goes on: the signed-in shell and a loaded profile, never an empty shell. */
async function finishSignIn(page: Page, start?: () => Promise<void>) {
  if (start) await start()
  await expect(page.getByRole('button', { name: /^Profile menu/ }).or(page.getByRole('heading', { name: /What should I call you/ }))).toBeVisible({ timeout: 90_000 })
  await expect.poll(async () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('buddget-storage') ?? 'null')?.state?.profile?.id ?? null } catch { return null } }), { timeout: 60_000 }).not.toBeNull()
  // The auth session is written to storage asynchronously; give it a beat before the first full navigation.
  await page.waitForTimeout(1500)
}

/** Opens a settings sub-page and waits until the plan state has loaded (no skeleton). */
export async function openLoaded(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect.poll(async () => (await page.locator('main').first().innerText().catch(() => '')).trim().length, { timeout: 60_000 }).toBeGreaterThan(20)
  await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined)
}
