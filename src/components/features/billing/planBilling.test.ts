import { describe, expect, it } from 'vitest'
import type { BillingMe } from '@/lib/billing/billingStore'
import type { PlanOption } from '@/lib/billing/planOptions'
import type { ProThisMonth } from '@/lib/loyalty/rewardsTypes'
import { isStoreSubscriber, monthView, multipleLabel, planDisplays, planPageStateOf, priceRegion } from './planBilling'

const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, ...over })
const sub = { fromStore: true, billingIssue: false, graceEndsAt: null, willRenew: true, renewsAt: '2027-11-17T00:00:00Z', productId: 'pro_annual', memberSince: '2026-11-17T00:00:00Z' }

describe('which Plan and billing page a person gets', () => {
  it('Free, a trial and a member each get their own page', () => {
    expect(planPageStateOf(me({}))).toBe('free')
    expect(planPageStateOf(me({ planKey: 'plus_trial', status: 'trialing', trialEndsAt: '2026-12-16T00:00:00Z' }))).toBe('trial')
    expect(planPageStateOf(me({ planKey: 'plus', subscription: sub }))).toBe('pro')
  })
  it('a member whose Pro ended is back on the Free page; a cancelled period still running stays on the member page', () => {
    expect(planPageStateOf(me({ status: 'expired', subscription: sub }))).toBe('free')
    expect(planPageStateOf(me({ planKey: 'plus', status: 'canceled', subscription: { ...sub, willRenew: false } }))).toBe('pro')
  })
  it('only a paying store subscriber counts as one: not a trial, not a gift', () => {
    expect(isStoreSubscriber(me({ planKey: 'plus', subscription: sub }))).toBe(true)
    expect(isStoreSubscriber(me({ planKey: 'plus', subscription: { ...sub, fromStore: false } }))).toBe(false)
    expect(isStoreSubscriber(me({ planKey: 'plus_trial', status: 'trialing', trialEndsAt: '2026-12-16T00:00:00Z', subscription: sub }))).toBe(false)
    expect(isStoreSubscriber(me({}))).toBe(false)
  })
})

describe('the plans block prices', () => {
  it('the region follows the country, then the base currency, else USD', () => {
    expect(priceRegion('EG', 'USD')).toBe('EG')
    expect(priceRegion('ae', null)).toBe('AE')
    expect(priceRegion('FR', 'SAR')).toBe('SA')
    expect(priceRegion(undefined, 'QAR')).toBe('QA')
    expect(priceRegion('FR', 'EUR')).toBe('US')
  })
  it('without the store, the owner’s prices: Egypt yearly 499.99 against twelve months, saving 40%', () => {
    const [yearly, monthly] = planDisplays('EG', [])
    expect(yearly).toMatchObject({ kind: 'annual', price: 'EGP 499.99', perMonth: 'EGP 41.67', struck: 'EGP 839.88', savePct: 40, option: null })
    expect(monthly).toMatchObject({ kind: 'monthly', price: 'EGP 69.99', savePct: 0 })
    expect(planDisplays('US', [])[0]).toMatchObject({ price: 'USD 24.99', struck: 'USD 59.88', savePct: 58 })
  })
  it('the store price wins once the store answers', () => {
    const option = (kind: 'annual' | 'monthly', price: number, priceString: string): PlanOption => ({ kind, price: priceString, perMonth: null, pkg: { product: { price, currencyCode: 'AED', priceString } } as PlanOption['pkg'] })
    const [yearly, monthly] = planDisplays('EG', [option('annual', 120, 'AED 120.00'), option('monthly', 20, 'AED 20.00')])
    expect(yearly).toMatchObject({ price: 'AED 120.00', perMonth: 'AED 10.00', struck: 'AED 240.00', savePct: 50 })
    expect(yearly!.option).not.toBeNull()
    expect(monthly!.price).toBe('AED 20.00')
  })
})

describe('Pro this month', () => {
  const month = (credits: number, answers: number, receipts: number): ProThisMonth => ({
    aiAnswers: { thisMonth: answers, lastMonth: 100 }, receiptsScanned: { thisMonth: receipts, lastMonth: 0 }, creditsUsed: { thisMonth: credits, lastMonth: credits }, monthStart: '2026-11-01',
    freeCaps: { aiCreditsWeek: 15, aiCreditsSession: 6, balanceViewsPerMonth: 10, budgetPlansMax: 2, advisorFreePerMonth: 1, smsAiCallsPerMonth: 30 },
  })
  it('heavy use: several times Free’s allowance, every limit passed, Free’s stop marked along each bar', () => {
    const v = monthView(month(455, 200, 30), 19)
    expect(Math.round(v.multiple)).toBe(7)
    expect(multipleLabel(v.multiple)).toBe('7×')
    expect(v.passed).toBe(4)
    expect(v.tiles.find((t) => t.key === 'answers')).toMatchObject({ value: 200, cap: 29, capPct: 14, deltaPct: 100 })
    expect(v.tiles.find((t) => t.key === 'views')).toMatchObject({ value: 19, cap: 10, approx: false, capPct: 53 })
  })
  it('light use stays inside Free: nothing passed, the mark at the end of the bar', () => {
    const v = monthView(month(10, 20, 1), 2)
    expect(v.multiple).toBeLessThan(1)
    expect(v.passed).toBe(0)
    expect(v.tiles.every((t) => t.capPct === 100)).toBe(true)
  })
  it('no use at all still draws', () => {
    const v = monthView(month(0, 0, 0), 0)
    expect(v.tiles.map((t) => t.value)).toEqual([0, 0, 0, 0])
    expect(v.passed).toBe(0)
  })
})
