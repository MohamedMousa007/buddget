import { describe, expect, it } from 'vitest'
import type { BillingMe } from '@/lib/billing/billingStore'
import { canSeeAdvancedInsights, rangeIsFree } from './access'

const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, ...over }) as BillingMe

describe('canSeeAdvancedInsights', () => {
  it('opens everything while billing is off, unknown or still loading', () => {
    expect(canSeeAdvancedInsights(null)).toBe(true)
    expect(canSeeAdvancedInsights(undefined)).toBe(true)
    expect(canSeeAdvancedInsights(me({ billingEnabled: false }))).toBe(true)
  })
  it('locks Free when billing is on', () => {
    expect(canSeeAdvancedInsights(me({}))).toBe(false)
    expect(canSeeAdvancedInsights(me({ features: [] }))).toBe(false)
  })
  it('follows the features list, including per-user overrides', () => {
    expect(canSeeAdvancedInsights(me({ features: ['advanced_reports'] }))).toBe(true)
    expect(canSeeAdvancedInsights(me({ planKey: 'plus', features: ['budget_compare'] }))).toBe(false)
  })
  it('falls back to the plan when the server sent no features', () => {
    expect(canSeeAdvancedInsights(me({ planKey: 'plus' }))).toBe(true)
  })
})

describe('rangeIsFree', () => {
  it('keeps 3 cycles for Free and moves 6 months and the year to Pro', () => {
    expect(['thisMonth', 'lastMonth', 'last3Months'].every((r) => rangeIsFree(r as never))).toBe(true)
    expect(rangeIsFree('last6Months')).toBe(false)
    expect(rangeIsFree('thisYear')).toBe(false)
  })
})
