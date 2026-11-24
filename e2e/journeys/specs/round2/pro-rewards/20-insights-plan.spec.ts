// Insights page (782a1e18 and follow-ups) and Plan and billing after BDG-020 (830fce82). State is set with service-role
// writes to the synthetic user's own rows after the app's automatic trial claim lands, so the plan is the one asked for.
import type { Page } from '@playwright/test'
import { test, expect, signInUi, openLoaded } from './fixture'
import { FREE, PRO_ACTIVE, TRIAL, setEntitlement, svc } from '../../../../api/round2/pro-rewards/lib'

const main = (page: Page) => page.locator('main')

/** Sign in, wait for the automatic trial claim (it would otherwise overwrite the seeded plan), then set the plan. */
async function signInWithPlan(page: Page, u: { id: string; email: string }, plan: Record<string, unknown>) {
  await signInUi(page, u.email)
  await expect.poll(async () => (await svc(`trial_claims?user_id=eq.${u.id}&select=user_id`)).json.length, { timeout: 60_000 }).toBe(1)
  await setEntitlement(u.id, plan)
}

const day = (d: number) => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, now.getDate())).padStart(2, '0')}`
}

async function seedMonth(userId: string) {
  const post = (table: string, rows: unknown) => svc(table, { method: 'POST', body: JSON.stringify(rows) })
  const inc = await post('income_sources', { user_id: userId, name: 'QA Salary', amount: 20000, currency: 'EGP', effective_start: '2026-01-01', is_recurring: true, recurring_frequency: 'monthly', day_of_month: 1 })
  if (inc.status >= 300) throw new Error(`income ${inc.status}`)
  const rows = [
    ...Array.from({ length: 9 }, (_, i) => ({ user_id: userId, amount: 30, currency: 'EGP', category: 'Food', description: `QA coffee ${i + 1}`, expense_date: day(2 + i) })),
    { user_id: userId, amount: 900, currency: 'EGP', category: 'Groceries', description: 'QA groceries 1', expense_date: day(3) },
    { user_id: userId, amount: 700, currency: 'EGP', category: 'Groceries', description: 'QA groceries 2', expense_date: day(9) },
  ]
  const ex = await post('expenses', rows)
  if (ex.status >= 300) throw new Error(`expenses ${ex.status}`)
}

test('I1 Insights on Free: the daily answer, readable findings, a locked finding opens its Pro sheet', async ({ page, qa }) => {
  const u = await qa('i1')
  await seedMonth(u.id)
  await signInWithPlan(page, u, FREE())
  await openLoaded(page, '/reports')
  await expect(main(page).getByText('You can spend').first()).toBeVisible({ timeout: 60_000 })
  await expect(main(page).getByText(/a day/).first()).toBeVisible()
  await expect(main(page).getByText('Things you may not know')).toBeVisible()
  const unlock = main(page).getByRole('button', { name: 'Unlock with Pro' }).first()
  await expect(unlock).toBeVisible()
  await unlock.click()
  const sheet = page.getByRole('dialog', { name: 'This one is part of Pro' })
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('••••')
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toBeHidden()
})

test('I2 @desktop Insights on Pro: nothing is locked', async ({ page, qa }) => {
  const u = await qa('i2')
  await seedMonth(u.id)
  await signInWithPlan(page, u, PRO_ACTIVE())
  await openLoaded(page, '/reports')
  await expect(main(page).getByText('Things you may not know')).toBeVisible({ timeout: 60_000 })
  await expect(main(page).getByText(/small buys under/).first()).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Unlock with Pro' })).toHaveCount(0)
})

test('P1 BDG-020 Pro from the store: Change plan and Cancel subscription at the end, no Manage bar or receipts; each opens its sheet', async ({ page, qa }) => {
  const u = await qa('p1')
  await signInWithPlan(page, u, PRO_ACTIVE())
  await openLoaded(page, '/settings/pro')
  const m = main(page)
  await expect(m.getByRole('button', { name: 'Change plan' })).toBeVisible()
  await expect(m.getByRole('button', { name: 'Cancel subscription' })).toBeVisible()
  await expect(m.getByText('Manage subscription')).toHaveCount(0)
  await expect(m.getByRole('button', { name: /^(Receipts|Restore|Manage)$/ })).toHaveCount(0)
  await expect(m.getByText('Billed by App Store')).toBeVisible()

  await m.getByRole('button', { name: 'Change plan' }).click()
  const plans = page.getByRole('dialog', { name: 'Choose a plan' })
  await expect(plans).toBeVisible()
  await plans.getByRole('button', { name: /close/i }).first().click()
  await expect(plans).toBeHidden()

  // On the web there is no store: no stay offer, straight to the store hand-off (the iOS stay offer is a native check).
  await m.getByRole('button', { name: 'Cancel subscription' }).click()
  const cancel = page.getByRole('dialog', { name: 'Cancel subscription' })
  await expect(cancel).toContainText(/You finish cancelling in App Store\. You keep Pro until /)
  await expect(cancel.getByRole('button', { name: 'Cancel in store' })).toBeVisible()
  await expect(cancel.getByRole('button', { name: 'Stay with Pro' })).toHaveCount(0)
})

test('P2 BDG-020 no Cancel row for a trial, a member who already cancelled, or Pro that is not from a store', async ({ page, qa }) => {
  const u = await qa('p2')
  await signInWithPlan(page, u, TRIAL())
  await openLoaded(page, '/settings/pro')
  await expect(main(page).getByRole('button', { name: 'Cancel subscription' })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Change plan' })).toHaveCount(0)

  // What the RevenueCat webhook writes for a cancellation: still Pro to the period end, not renewing.
  await setEntitlement(u.id, { ...PRO_ACTIVE(), will_renew: false, canceled_at: new Date().toISOString() })
  await openLoaded(page, '/settings/pro')
  await expect(main(page).getByRole('button', { name: 'Change plan' })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Cancel subscription' })).toHaveCount(0)

  await setEntitlement(u.id, { ...PRO_ACTIVE(), source: 'promo', store: null, product_id: null, will_renew: null, canceled_at: null })
  await openLoaded(page, '/settings/pro')
  await expect(main(page).getByRole('button', { name: 'Change plan' })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Cancel subscription' })).toHaveCount(0)
})
