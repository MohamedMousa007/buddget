import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { AppSettings, BudgetPlan, Currency, UserProfile } from '@/lib/store/types'

export interface BaseCurrencySlice {
  settings: AppSettings
  profile: UserProfile
  budgetPlans: BudgetPlan[]
  exchangeRates: Record<string, number>
  /** Per gram, denominated in the base currency. */
  goldPricePerGram: number
}

export type BaseCurrencySwitch =
  | { ok: true; patch: Pick<BaseCurrencySlice, 'settings' | 'profile' | 'budgetPlans' | 'goldPricePerGram'> }
  | { ok: false; reason: 'same' | 'noRate' }

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Nothing in storage is converted when the base currency changes: expenses, goals, debts and
 * subscriptions each carry their own currency and convert at read time. What WOULD silently change
 * meaning is anything stored as a bare number "in base currency", so a switch must:
 *  - stamp budget lines that have no currency with the OLD base (they read as "the current base");
 *  - convert the scalars documented as base-denominated (rent, emergency-fund essentials, zakat overrides, gold price);
 *  - keep the secondary currency distinct from the new base.
 */
export function planBaseCurrencySwitch(slice: BaseCurrencySlice, next: Currency): BaseCurrencySwitch {
  const { settings, profile, budgetPlans, exchangeRates, goldPricePerGram } = slice
  const old = settings.baseCurrency
  if (next === old) return { ok: false, reason: 'same' }
  if (tryConvertCurrency(1, old, next, exchangeRates) === null) return { ok: false, reason: 'noRate' }

  const conv = (n: number) => round2(tryConvertCurrency(n, old, next, exchangeRates) ?? n)

  const nextProfile: UserProfile = { ...profile }
  if (typeof profile.monthlyRent === 'number') nextProfile.monthlyRent = conv(profile.monthlyRent)
  if (profile.emergencyFundConfig?.monthlyEssentials) {
    nextProfile.emergencyFundConfig = {
      ...profile.emergencyFundConfig,
      monthlyEssentials: conv(profile.emergencyFundConfig.monthlyEssentials),
    }
  }
  if (profile.zakatConfig) {
    const z = profile.zakatConfig
    nextProfile.zakatConfig = {
      ...z,
      manualAmount: typeof z.manualAmount === 'number' ? conv(z.manualAmount) : z.manualAmount,
      lineOverrides: z.lineOverrides
        ? Object.fromEntries(Object.entries(z.lineOverrides).map(([k, v]) => [k, conv(v)]))
        : z.lineOverrides,
    }
  }

  const nextPlans = budgetPlans.map((plan) => ({
    ...plan,
    categories: plan.categories.map((c) =>
      c.currency && FIAT_CURRENCIES.includes(c.currency) ? c : { ...c, currency: old },
    ),
  }))

  const nextSettings: AppSettings = {
    ...settings,
    baseCurrency: next,
    secondaryCurrency: settings.secondaryCurrency === next ? old : settings.secondaryCurrency,
  }

  return { ok: true, patch: { settings: nextSettings, profile: nextProfile, budgetPlans: nextPlans, goldPricePerGram: conv(goldPricePerGram) } }
}
