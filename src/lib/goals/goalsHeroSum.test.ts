import { describe, expect, it } from 'vitest'
import type { Goal } from '@/lib/store/types'
import { goalsHeroSum } from './goalsHeroSum'

const goal = (extra: Partial<Goal>): Goal => ({
  id: 'g', name: 'Trip', emoji: '', category: 'vacation', targetAmount: 1000, currency: 'EGP', manualCurrentAmount: 0,
  targetDate: '2027-03-01', linkedSavingsAccountIds: [], linkedDebtIds: [], monthlySpendingLimit: null, priority: 0, status: 'active',
  monthlyContribution: null, fundingMode: 'manual', sharePct: null, frequency: 'monthly', planStart: null, notes: null,
  createdAt: '2026-01-01', achievedAt: null, ...extra,
}) as Goal

const ctx = (extra: Partial<Parameters<typeof goalsHeroSum>[1]> = {}) => ({
  base: 'EGP', usualKeep: 10000, rates: { USD_EGP: 50 }, gold: { pricePerGram: 4000, available: true }, ...extra,
})

describe('goalsHeroSum (goals hero, live QA W3: "≈ 1,884,639 a month" flash)', () => {
  it('a share goal takes its share of the usual keep; a fixed goal its amount per month', () => {
    const sum = goalsHeroSum([
      { goal: goal({ id: 'a', fundingMode: 'share', sharePct: 20 }), current: 100 },
      { goal: goal({ id: 'b', fundingMode: 'fixed', monthlyContribution: 3000, frequency: 'quarterly' }), current: 200 },
    ], ctx())
    expect(sum.monthly).toBeCloseTo(2000 + 1000)
    expect(sum.saved).toBe(300)
    expect(sum.want).toBe(2000)
  })

  it('a USD goal round-trips through real rates', () => {
    const sum = goalsHeroSum([{ goal: goal({ currency: 'USD', fundingMode: 'share', sharePct: 50 }), current: 10 }], ctx())
    expect(sum.monthly).toBeCloseTo(5000)
    expect(sum.saved).toBeCloseTo(500)
  })

  it('a currency with no rate is left out, never counted in the wrong unit', () => {
    const sum = goalsHeroSum([{ goal: goal({ currency: 'ZZZ' as Goal['currency'], fundingMode: 'fixed', monthlyContribution: 37692 }), current: 1 }], ctx({ rates: {} }))
    expect(sum.monthly).toBe(0)
    expect(sum.saved).toBe(0)
  })

  it('a gold goal is priced in grams through the gram price, and left out while the price is missing', () => {
    const g = goal({ currency: 'XAU' as Goal['currency'], fundingMode: 'fixed', monthlyContribution: 2, targetAmount: 50 })
    expect(goalsHeroSum([{ goal: g, current: 10 }], ctx()).monthly).toBeCloseTo(8000)
    expect(goalsHeroSum([{ goal: g, current: 10 }], ctx({ gold: { pricePerGram: 0, available: false } })).monthly).toBe(0)
  })

  it('paused, achieved, limit and debt goals add no pace', () => {
    const sum = goalsHeroSum([
      { goal: goal({ status: 'paused', fundingMode: 'fixed', monthlyContribution: 500 }), current: 0 },
      { goal: goal({ status: 'achieved', fundingMode: 'fixed', monthlyContribution: 500 }), current: 0 },
      { goal: goal({ category: 'spending_control', fundingMode: 'fixed', monthlyContribution: 500 }), current: 0 },
      { goal: goal({ category: 'debt_freedom', fundingMode: 'fixed', monthlyContribution: 500 }), current: 0 },
    ], ctx())
    expect(sum.monthly).toBe(0)
  })
})
