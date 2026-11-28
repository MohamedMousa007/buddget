/* eslint-disable @typescript-eslint/no-explicit-any -- test code reads untyped PostgREST JSON */
import { randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, test } from '../lib/fixtures'
import { env } from '../lib/env'

/**
 * Website waitlist (PR #56): join, the member's guest pass and share link, the invite landing a friend opens, and the
 * friend's sign-up recorded against the member's code. No sign-in, so it runs against a Vercel preview (QA_BASE=<url>).
 * Synthetic addresses only (qa-e2e-wl-*@buddget-qa.test); every row they create is deleted at the end and counted.
 */
test.describe.configure({ mode: 'serial' })

const tag = randomBytes(3).toString('hex')
const member = `qa-e2e-wl-${tag}-a@buddget-qa.test`
const friend = `qa-e2e-wl-${tag}-b@buddget-qa.test`

const rest = async (path: string, init: RequestInit = {}) => {
  const key = env('SUPABASE_SECRET_KEY')
  const r = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } })
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
const waitlistRow = async (email: string) => ((await rest(`waitlist_signups?email=eq.${encodeURIComponent(email)}&select=share_code,referred_by,country,platform,locale`)) as any[])[0]

async function join(page: Page, email: string, name: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel(/First name/).fill(name)
  await page.getByLabel('Country').selectOption('EG')
  await page.getByRole('button', { name: 'iPhone' }).click()
  await page.getByRole('button', { name: 'Join the waitlist' }).last().click()
  await expect(page.getByText('You’re on the list.')).toBeVisible({ timeout: 30_000 })
}

test.afterAll(async () => {
  await rest(`waitlist_signups?email=like.qa-e2e-wl-${tag}-*`, { method: 'DELETE' })
  const left = (await rest(`waitlist_signups?email=like.qa-e2e-wl-${tag}-*&select=id`)) as any[]
  expect(left, 'synthetic waitlist rows left').toHaveLength(0)
})

test('W1 waitlist: a member joins, gets the guest pass signed with their name and a share link; a friend who opens it sees the pass and joins under that code', async ({ page, browser }) => {
  await page.goto('/en/waitlist')
  await expect(page.getByRole('link', { name: /Try it in your browser|Log in/ })).toHaveCount(0)
  await join(page, member, 'Layla')

  await expect(page.getByRole('button', { name: 'Your guest pass. Tap to flip' })).toBeVisible()
  await expect(page.getByText('from Layla').first()).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Bring your friends' }).inputValue()
  expect(link).toMatch(/\/en\/waitlist\/invite\?ref=W[2-9A-HJKMNP-Z]{7}$/)
  const code = new URL(link).searchParams.get('ref')!
  expect(await waitlistRow(member)).toMatchObject({ share_code: code, country: 'EG', platform: 'ios', locale: 'en', referred_by: null })

  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'en-US', timezoneId: 'Africa/Cairo' })
  const friendPage = await ctx.newPage()
  await friendPage.goto(new URL(link).pathname + new URL(link).search)
  await expect(friendPage.getByRole('heading', { name: 'Layla sent you a guest pass' })).toBeVisible({ timeout: 30_000 })
  await expect(friendPage.getByText(code).first()).toBeVisible()
  expect(await friendPage.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex')
  await join(friendPage, friend, 'Omar')
  expect((await waitlistRow(friend))?.referred_by, 'the friend is recorded under the member code').toBe(code)

  await friendPage.goto(`/ar/waitlist/invite?ref=${code}`)
  await expect(friendPage.getByRole('heading', { name: 'أرسل لك Layla بطاقة ضيف' })).toBeVisible({ timeout: 30_000 })
  await ctx.close()
})

test('W2 waitlist: a repeat address is told it is on the list but gets no share code, and a bad invite code shows the open waitlist', async ({ page }) => {
  await page.goto('/en/waitlist')
  await join(page, member, 'Someone else')
  await expect(page.getByRole('button', { name: 'Your guest pass. Tap to flip' })).toHaveCount(0)
  await page.goto('/en/waitlist/invite?ref=not-a-code')
  await expect(page.getByText('This link has no invite code, but the waitlist is open to everyone.')).toBeVisible({ timeout: 30_000 })
})
