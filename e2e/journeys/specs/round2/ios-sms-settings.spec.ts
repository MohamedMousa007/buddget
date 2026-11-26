/* eslint-disable @typescript-eslint/no-explicit-any -- test code: a fake Capacitor bridge and untyped JSON */
import { test, expect, type Page } from '@playwright/test'
import { PASSWORD, createConfirmedUser, deleteUser, qaEmail } from '../../lib/admin'
import { env } from '../../lib/env'

/**
 * BDG-008 on the settings page, as an iPhone sees it (findings/B-sms-setup.md). The browser plays the iOS app: a fake
 * WKWebView bridge makes Capacitor report 'ios', and the SMS plugin's getStatus answers with this phone's facts.
 * - never set up here: a "Set up" button, no switch
 * - setup claimed: the switch, "View guide" beside it, "Waiting for your first text"
 * - a Shortcut run seen: the switch, "Working · no bank text yet"
 * - the guide's guard: "I already know the steps" asks before it marks this phone set up
 */

const SMS_METHODS = ['checkPermission', 'requestPermission', 'saveToken', 'setEnabled', 'setSetupCompleted', 'setForwardMode', 'clearCredentials', 'clearState', 'setDeviceSecret', 'getDeviceSecret', 'removeDeviceSecret', 'setSecureItem', 'getSecureItem', 'removeSecureItem', 'getStatus', 'healthCheck', 'peekPendingQueue', 'removePending']

interface Facts { setupCompleted: boolean; lastRunAt?: string; enabled: boolean }

async function asIphone(page: Page, facts: Facts, session: unknown, storageKey: string) {
  await page.addInitScript(
    ({ facts, methods, session, storageKey }) => {
      const w = window as any
      w.__sms = { tokenSaved: false, enabled: facts.enabled, setupCompleted: facts.setupCompleted, wired: facts.setupCompleted || !!facts.lastRunAt, permission: true, lastRunAt: facts.lastRunAt, tokenUserId: '' }
      w.webkit = { messageHandlers: { bridge: { postMessage() {} } } }
      w.Capacitor = {
        PluginHeaders: [{ name: 'SmsCapacitorPlugin', methods: methods.map((name: string) => ({ name, rtype: 'promise' })) }],
        nativeCallback: () => '',
        nativePromise: async (plugin: string, method: string, options: any) => {
          if (plugin !== 'SmsCapacitorPlugin') return {}
          if (method === 'getStatus') return { ...w.__sms }
          if (method === 'setSetupCompleted') w.__sms.setupCompleted = !!options?.completed
          if (method === 'setEnabled') w.__sms.enabled = !!options?.enabled
          if (method === 'saveToken') w.__sms.tokenSaved = true
          if (method === 'checkPermission' || method === 'requestPermission') return { granted: true }
          if (method === 'peekPendingQueue') return { items: [] }
          if (method === 'healthCheck') return { ok: true }
          return { value: null, secret: null }
        },
      }
      // The native app keeps the session in localStorage (src/lib/supabase/client.ts), not in cookies.
      if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(session))
    },
    { facts, methods: SMS_METHODS, session, storageKey },
  )
}

async function passwordSession(email: string) {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`password sign-in failed: ${res.status}`)
  const session = await res.json()
  const ref = new URL(url).hostname.split('.')[0]
  return { session, storageKey: `sb-${ref}-auth-token` }
}

const smsRow = (page: Page) => page.locator('[data-setting-id="sms"]')

test.describe('iPhone SMS tracking on Settings (BDG-008)', () => {
  let email = ''
  let auth: { session: unknown; storageKey: string }

  test.beforeAll(async () => {
    email = qaEmail('ios')
    await createConfirmedUser(email)
    auth = await passwordSession(email)
  })
  test.afterAll(async () => {
    if (email) await deleteUser(email)
  })

  test('never set up on this iPhone: a "Set up" button, no switch', async ({ page }) => {
    await asIphone(page, { setupCompleted: false, enabled: false }, auth.session, auth.storageKey)
    await page.goto('/settings')
    await expect(smsRow(page)).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('sms-setup-button')).toHaveText('Set up')
    await expect(page.getByRole('switch', { name: 'SMS tracking' })).toHaveCount(0)
    await expect(page.getByTestId('sms-view-guide')).toHaveCount(0)
    if (process.env.QA_SHOT) await smsRow(page).screenshot({ path: process.env.QA_SHOT.replace('.png', '-setup.png') })
  })

  test('setup claimed here: the switch, "View guide" beside it, and "Waiting for your first text"', async ({ page }) => {
    await asIphone(page, { setupCompleted: true, enabled: true }, auth.session, auth.storageKey)
    await page.goto('/settings')
    const sw = page.getByRole('switch', { name: 'SMS tracking' })
    await expect(sw).toBeVisible({ timeout: 90_000 })
    const guide = page.getByTestId('sms-view-guide')
    await expect(guide).toHaveText('View guide')
    const [g, s] = await Promise.all([guide.boundingBox(), sw.boundingBox()])
    expect(g && s && g.x + g.width <= s.x + 1).toBeTruthy()
    await expect(smsRow(page)).toContainText('Waiting for your first text')
    await expect(page.getByTestId('sms-setup-button')).toHaveCount(0)
    if (process.env.QA_SHOT) await smsRow(page).screenshot({ path: process.env.QA_SHOT })
    await guide.click()
    await expect(page).toHaveURL(/\/settings\/sms/)
    // Straight to the guide's first page: no in-between screen with a second setup button.
    await expect(page.getByText('I already know the steps')).toBeVisible()
    await expect(page.getByText('Not confirmed yet · waiting')).toHaveCount(0)
  })

  test('a Shortcut run seen here: the switch and "Working · no bank text yet"', async ({ page }) => {
    await asIphone(page, { setupCompleted: false, lastRunAt: new Date().toISOString(), enabled: true }, auth.session, auth.storageKey)
    await page.goto('/settings')
    await expect(page.getByRole('switch', { name: 'SMS tracking' })).toBeVisible({ timeout: 90_000 })
    await expect(smsRow(page)).toContainText('Working · no bank text yet')
  })

  test('"Set up" opens the guide, and "I already know the steps" asks before it marks this phone set up', async ({ page }) => {
    await asIphone(page, { setupCompleted: false, enabled: false }, auth.session, auth.storageKey)
    await page.goto('/settings')
    await page.getByTestId('sms-setup-button').click({ timeout: 90_000 })
    await expect(page).toHaveURL(/\/settings\/sms/)
    await page.getByText('I already know the steps').click()
    await expect(page.getByRole('alertdialog').or(page.getByRole('dialog').filter({ hasText: /skip|already/i })).first()).toBeVisible()
    expect(await page.evaluate(() => (window as any).__sms.setupCompleted)).toBe(false)
  })
})
