import { describe, expect, it } from 'vitest'
import { planBaseCurrencySwitch, type BaseCurrencySlice } from '@/lib/settings/baseCurrencySwitch'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import type { BudgetPlan } from '@/lib/store/types'

const rates = { EGP_USD: 0.02, USD_EGP: 50 }

const plan = (currencies: Array<'EGP' | 'USD' | undefined>): BudgetPlan => ({
  id: 'p1',
  name: 'Plan',
  createdAt: '2026-01-01',
  categories: currencies.map((currency, i) => ({
    id: `c${i}`,
    name: `Line ${i}`,
    icon: 'x',
    amount: 1000,
    currency,
    subcategories: [],
  })),
})

const slice = (over: Partial<BaseCurrencySlice> = {}): BaseCurrencySlice => ({
  settings: { ...DEFAULT_SETTINGS, baseCurrency: 'EGP', secondaryCurrency: 'USD', showSecondaryCurrency: true },
  profile: { ...DEFAULT_PROFILE, monthlyRent: 10000 },
  budgetPlans: [plan([undefined, 'EGP', 'USD'])],
  exchangeRates: rates,
  ...over,
})

describe('planBaseCurrencySwitch', () => {
  it('refuses a no-op and a switch with no rate path', () => {
    expect(planBaseCurrencySwitch(slice(), 'EGP')).toEqual({ ok: false, reason: 'same' })
    expect(planBaseCurrencySwitch(slice({ exchangeRates: {} }), 'KWD')).toEqual({ ok: false, reason: 'noRate' })
  })

  it('stamps currency-less budget lines with the OLD base and leaves stamped ones alone', () => {
    const r = planBaseCurrencySwitch(slice(), 'USD')
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.budgetPlans[0].categories.map((c) => c.currency)).toEqual(['EGP', 'EGP', 'USD'])
    expect(r.patch.budgetPlans[0].categories.map((c) => c.amount)).toEqual([1000, 1000, 1000])
  })

  it('converts the monthly rent at the current rate', () => {
    const r = planBaseCurrencySwitch(slice(), 'USD')
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.profile.monthlyRent).toBe(200)
  })

  it('converts emergency-fund essentials and zakat overrides, leaving unset ones unset', () => {
    const s = slice({
      profile: {
        ...DEFAULT_PROFILE,
        emergencyFundConfig: { targetMonths: 6, monthlyEssentials: 5000 },
        zakatConfig: { nisabBasis: 'gold', holdsForTrading: false, manualAmount: 2500, lineOverrides: { gold: 1000 } },
      },
    })
    const r = planBaseCurrencySwitch(s, 'USD')
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.profile.emergencyFundConfig?.monthlyEssentials).toBe(100)
    expect(r.patch.profile.zakatConfig?.manualAmount).toBe(50)
    expect(r.patch.profile.zakatConfig?.lineOverrides).toEqual({ gold: 20 })
    expect(r.patch.profile.monthlyRent).toBeUndefined()

    const bare = planBaseCurrencySwitch(slice({ profile: { ...DEFAULT_PROFILE } }), 'USD')
    if (!bare.ok) throw new Error('expected ok')
    expect(bare.patch.profile.emergencyFundConfig).toBeUndefined()
    expect(bare.patch.profile.zakatConfig).toBeUndefined()
  })

  it('swaps instead of duplicating when the new base was the secondary', () => {
    const r = planBaseCurrencySwitch(slice(), 'USD')
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.settings.baseCurrency).toBe('USD')
    expect(r.patch.settings.secondaryCurrency).toBe('EGP')
  })

  it('keeps an unrelated secondary currency', () => {
    const s = slice({ settings: { ...DEFAULT_SETTINGS, baseCurrency: 'EGP', secondaryCurrency: 'AED', showSecondaryCurrency: true }, exchangeRates: { ...rates, EGP_AED: 0.07, AED_EGP: 14 } })
    const r = planBaseCurrencySwitch(s, 'USD')
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.settings.secondaryCurrency).toBe('AED')
  })

  it('does not mutate its input', () => {
    const s = slice()
    const before = JSON.stringify(s)
    planBaseCurrencySwitch(s, 'USD')
    expect(JSON.stringify(s)).toBe(before)
  })
})
