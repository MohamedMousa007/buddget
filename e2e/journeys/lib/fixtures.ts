/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/rules-of-hooks -- test code: untyped store/PostgREST JSON; Playwright fixtures call use() */
import { test as base, expect, type Page } from '@playwright/test'
import { PASSWORD, createConfirmedUser, deleteUser, qaEmail } from './admin'
import { forceFlags, installApiShim } from './apiShim'

export interface QaUser { email: string; id: string }

/** Every journey gets its own synthetic account (created confirmed via the admin API, no email sent), signed in through the UI. */
export const test = base.extend<{ shim: void; user: QaUser; keepUser: boolean; onboarding: boolean }>({
  keepUser: [false, { option: true }],
  onboarding: [false, { option: true }],
  shim: [async ({ context, onboarding }, use) => {
    await installApiShim(context)
    // Dev-only Next.js overlay badge sits on top of the bottom-left tab at phone width; hide it so clicks reach the app.
    await context.addInitScript(() => {
      const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s))
    })
    // Onboarding is a 10% rollout. Journeys that are not about onboarding switch it off so it never steals the screen.
    await forceFlags(context, { onboarding_v1: onboarding })
    await use()
  }, { auto: true }],
  user: async ({ page, context, keepUser }, use, info) => {
    const email = qaEmail(info.title.match(/^([A-Z][0-9]?)/)?.[1]?.toLowerCase() ?? 'j')
    const id = await createConfirmedUser(email)
    info.annotations.push({ type: 'qa-user', description: `${email} ${id}` })
    await signIn(page, email)
    await use({ email, id })
    if (keepUser || process.env.QA_KEEP_USERS) return
    // The open page keeps pushing writes; a delete that races them fails with a 500. Stop the app first, then retry.
    await context.close()
    let failure: unknown
    for (const waitMs of [0, 1000, 3000, 6000]) {
      await new Promise((r) => setTimeout(r, waitMs))
      failure = await deleteUser(email).then(() => undefined, (e) => e)
      if (!failure) return
    }
    throw new Error(`synthetic user ${email} (${id}) was not deleted, remove it by hand: ${failure}`)
  },
})
export { expect }

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/flow', { waitUntil: 'domcontentloaded' })
  // The dev server sometimes serves a blank first paint while it compiles (or after it restarts on its memory threshold); reload once.
  if (!(await page.getByRole('textbox', { name: 'Email' }).isVisible({ timeout: 30_000 }).catch(() => false))) await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('textbox', { name: 'Email' }).fill(email, { timeout: 60_000 })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign me in' }).click()
  // New accounts may be sent to the onboarding journey (/start), which has no tab bar.
  await expect(page.getByRole('button', { name: /^Profile menu/ }).or(page.getByRole('heading', { name: /What should I call you/ }))).toBeVisible({ timeout: 60_000 })
  await waitSynced(page)
}

/** The first server pull has finished (the store holds this account's profile). */
export async function waitSynced(page: Page) {
  await expect.poll(async () => (await localState(page))?.profile?.id ?? null, { timeout: 60_000 }).not.toBeNull()
}

/** The persisted finance store (`localStorage['buddget-storage']`). */
export async function localState(page: Page): Promise<any> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('buddget-storage')
    return raw ? JSON.parse(raw).state : null
  })
}

/** Parses "1,400.00 EGP", "E£ 1,000", "-15,220" etc. */
export function money(text: string | null | undefined): number {
  const m = (text ?? '').replace(/[−–]/g, '-').match(/-?\s?[\d,]+(\.\d+)?/)
  if (!m) return NaN
  return Number(m[0].replace(/[\s,]/g, ''))
}

/** Number shown next to a label (hero tiles render the label and value as siblings under one parent). */
export async function tile(page: Page, label: string, scope = page.locator('main')): Promise<number> {
  const lab = scope.getByText(label, { exact: true }).first()
  await lab.waitFor()
  const txt = await lab.evaluate((el, label) => {
    let n: HTMLElement | null = el as HTMLElement
    for (let i = 0; i < 4 && n; i++) {
      const rest = (n.textContent ?? '').replace(label, '')
      if (/\d/.test(rest)) return rest
      n = n.parentElement
    }
    return ''
  }, label)
  return money(txt)
}

export async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /^(Profile menu|Back to Flow)/ }).first()).toBeVisible({ timeout: 60_000 })
}

/** Waits until `pick(localState)` returns something truthy (the store persists on a short debounce) and returns it. */
export async function localWait<T>(page: Page, pick: (s: any) => T, timeout = 15_000): Promise<NonNullable<T>> {
  let out: T | undefined
  await expect.poll(async () => { const s = await localState(page); out = s ? pick(s) : undefined; return !!out }, { timeout }).toBe(true)
  return out as NonNullable<T>
}

/**
 * Known defect: everything before this call must pass (setup, UI, local store); from here on the test is expected
 * to fail on the defect's own assertion. A broken setup therefore still shows red instead of a false "expected failure".
 */
export function knownBug(id: string, why: string) {
  test.info().annotations.push({ type: 'known-bug', description: `${id}: ${why}` })
  test.fail(true, `${id}: ${why}`)
}

/** The app's tab bar (phone) or sidebar (desktop): the navigation landmark that links to Flow. */
export const appNav = (page: Page) => page.getByRole('navigation').filter({ has: page.getByRole('link', { name: 'Accounts', exact: true }) }).first()

/** Light touch: net worth sits in the Accounts hero ("5,000 Net worth", one paragraph); Flow's hero shows spending only. */
export async function netWorth(page: Page): Promise<number> {
  if (!/\/accounts(\?|$)/.test(page.url())) await goto(page, '/accounts')
  const p = page.locator('main p').filter({ hasText: /Net worth\s*$/ }).first()
  await p.waitFor()
  return money(await p.textContent())
}

/** Light touch: Flow's hero shows money in as "↓ 3,000 in" or "+5,000 in" (no "Money in" tile). */
export async function moneyIn(page: Page): Promise<number> {
  if (!/\/flow(\?|$)/.test(page.url())) await goto(page, '/flow')
  let txt = ''
  await expect.poll(async () => {
    txt = await page.locator('main').evaluate((m) => {
      for (const el of Array.from(m.querySelectorAll('*'))) {
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (/^[↓+]?\s*[\d,.]+\s*in$/.test(t)) return t
      }
      return ''
    })
    return txt
  }, { timeout: 30_000, message: 'Flow hero "… in" figure' }).not.toBe('')
  return money(txt.replace(/[↓+]/g, ''))
}

/** Light touch Accounts hero: one note line "3,000 set aside · 14,220 owed on cards"; no set-aside part means 0. */
export async function setAside(page: Page): Promise<number> {
  if (!/\/accounts(\?|$)/.test(page.url())) await goto(page, '/accounts')
  await page.locator('main').getByText('Available now', { exact: true }).first().waitFor()
  const note = page.locator('main span').filter({ hasText: /^\s*[\d,.]+\s+set aside\s*$/ }).first()
  return (await note.count()) ? money(await note.textContent()) : 0
}

/**
 * What the tracked accounts hold. The light-touch hero no longer has an "In accounts" tile: it shows what is free
 * ("Available now") and what is set aside, and the accounts hold the two together.
 */
export async function inAccounts(page: Page): Promise<number> {
  if (!/\/accounts(\?|$)/.test(page.url())) await goto(page, '/accounts')
  return (await tile(page, 'Available now')) + (await setAside(page))
}
