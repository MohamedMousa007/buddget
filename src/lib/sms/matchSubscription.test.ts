import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { daysFromBillingDay, matchSubscription } from './matchSubscription'

interface SubRow {
  id: string
  plan_id?: string | null
  catalog_region?: string | null
  amount: number | null
  currency: string
  brand_key: string
  billing_day: number | null
  status: string
}

/** Minimal thenable query-builder stub — matchSubscription only ever does one select. */
function serviceWith(rows: SubRow[]): SupabaseClient {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is']) builder[m] = () => builder
  builder.then = (resolve: (v: { data: SubRow[] }) => unknown) => resolve({ data: rows })
  return { from: () => builder } as unknown as SupabaseClient
}

const netflix = (over: Partial<SubRow> = {}): SubRow => ({
  id: 'sub_netflix', amount: 200, currency: 'EGP', brand_key: 'netflix', billing_day: 10,
  status: 'active', plan_id: null, catalog_region: null, ...over,
})

const match = (rows: SubRow[], over: Partial<Parameters<typeof matchSubscription>[1]> = {}) =>
  matchSubscription(serviceWith(rows), {
    userId: 'u1', merchant: 'NETFLIX.COM', merchantNormalized: null,
    amount: 200, currency: 'EGP', day: '2026-07-10', exchangeRates: { USD_EGP: 50 },
    ...over,
  })

describe('matchSubscription', () => {
  it('links a renewal: right brand, right amount, on the billing day', async () => {
    await expect(match([netflix()])).resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  it('links within the ±5% amount tolerance', async () => {
    await expect(match([netflix()], { amount: 208 })).resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  // The regression. `return candidates.length === 1 ? {...} : null` handed back the sole
  // candidate even when the amount diverged, so the ±5% check above was dead code for the
  // common one-sub-per-brand case: a 2,000 EGP purchase became a 200 EGP Netflix payment.
  it('does NOT link when the amount diverged, even as the only candidate', async () => {
    await expect(match([netflix()], { amount: 2_000 })).resolves.toBeNull()
  })

  // The ±5% gate above would otherwise DROP a real plan change: Netflix EG 190 -> 270 is
  // 43% off, so the upgrade charge would neither link nor be categorised Subscription.
  it('links a plan upgrade and proposes it, rather than dropping the charge', async () => {
    const onStandard = netflix({ amount: 190, plan_id: 'netflix_standard', catalog_region: 'egypt' })
    await expect(match([onStandard], { amount: 270 })).resolves.toEqual({
      subscriptionId: 'sub_netflix',
      planChange: { planId: 'netflix_premium', planName: 'Premium', direction: 'upgrade' },
    })
  })

  it('links a plan downgrade and proposes it', async () => {
    const onStandard = netflix({ amount: 190, plan_id: 'netflix_standard', catalog_region: 'egypt' })
    await expect(match([onStandard], { amount: 110 })).resolves.toEqual({
      subscriptionId: 'sub_netflix',
      planChange: { planId: 'netflix_basic', planName: 'Basic', direction: 'downgrade' },
    })
  })

  it('still refuses a divergent amount that is no plan at all', async () => {
    const onStandard = netflix({ amount: 190, plan_id: 'netflix_standard', catalog_region: 'egypt' })
    // A promo/proration is not a plan change and must not be linked or proposed.
    await expect(match([onStandard], { amount: 150 })).resolves.toBeNull()
  })

  it('does NOT link a same-priced purchase far from the billing date', async () => {
    // Right brand, right amount, but three weeks off — a repeat purchase, not a renewal.
    await expect(match([netflix()], { day: '2026-07-25' })).resolves.toBeNull()
  })

  it('still links when the charge is a few days early or late', async () => {
    await expect(match([netflix()], { day: '2026-07-13' })).resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  it('returns null when the brand is unknown', async () => {
    await expect(match([netflix()], { merchant: 'LA ROSE PASTRY' })).resolves.toBeNull()
  })

  it('returns null when the user tracks no such subscription', async () => {
    await expect(match([])).resolves.toBeNull()
  })

  it('converts currency before comparing — subs are often billed in USD', async () => {
    // 4 USD sub, charged as 200 EGP at 50/USD.
    await expect(match([netflix({ amount: 4, currency: 'USD' })])).resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  it('falls back to the brand match when there is no amount to check', async () => {
    await expect(match([netflix({ amount: null })], { amount: 9_999 }))
      .resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  it('skips the date gate when the sub has no billing day', async () => {
    await expect(match([netflix({ billing_day: null })], { day: '2026-07-25' }))
      .resolves.toEqual({ subscriptionId: 'sub_netflix', planChange: null })
  })

  it('prefers a candidate that agrees over one it merely cannot check', async () => {
    // The unverifiable one is listed FIRST; returning early on it would link the wrong sub.
    const rows = [netflix({ id: 'sub_no_amount', amount: null }), netflix({ id: 'sub_right', amount: 200 })]
    await expect(match(rows)).resolves.toEqual({ subscriptionId: 'sub_right', planChange: null })
  })

  it('picks the candidate that actually agrees, not merely the first', async () => {
    const rows = [netflix({ id: 'sub_wrong', amount: 999 }), netflix({ id: 'sub_right', amount: 200 })]
    await expect(match(rows)).resolves.toEqual({ subscriptionId: 'sub_right', planChange: null })
  })
})

describe('daysFromBillingDay', () => {
  it('measures the short way round the month', () => {
    // Billed on the 1st, charged on the 28th: 4 days early, not 27 days late.
    expect(daysFromBillingDay('2026-06-28', 1)).toBe(3)
  })

  it('is zero on the billing day', () => {
    expect(daysFromBillingDay('2026-07-10', 10)).toBe(0)
  })

  it('clamps a billing day past the end of a short month', () => {
    // A sub billed on the 31st, in February — the 28th IS its billing day.
    expect(daysFromBillingDay('2026-02-28', 31)).toBe(0)
  })
})
