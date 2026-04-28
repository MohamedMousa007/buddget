import {
  applyDebtFromOnboarding,
  applyIncomeFromOnboarding,
  applyLocaleFromProfile,
  applyMapsTo,
  applyPaymentDrafts,
} from '@/lib/onboarding/onboardingPageHelpers'
import { findBrandByKey, detectCatalogRegion, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, IncomeSource, OnboardingPaymentDraft } from '@/lib/store/types'
import type { DebtOnboardingPayload } from '@/lib/onboarding/debtOnboardingTypes'
import {
  ONBOARDING_V2_STEP_COUNT,
  V2_PAYMENT_CHIPS,
  type OnboardingBudgetPersona,
  type V2PaymentChipId,
} from '@/lib/onboarding/v2/constants'

export interface V2IncomeRow {
  name: string
  amount: string
  currency: Currency
}

export interface V2FixedBill {
  key: 'rent' | 'dewa' | 'internet'
  enabled: boolean
  amount: string
}

export type V2CommitPayload =
  | { step: 0; displayName: string }
  | { step: 1; country: string }
  | { step: 2; incomeRows: V2IncomeRow[] }
  | { step: 3; fixedBills: V2FixedBill[] }
  | { step: 4; subscriptions: { brandKey: string; amount: number }[] }
  | { step: 5; payChipIds: V2PaymentChipId[]; customNames: string[] }
  | { step: 6; monthlySavings: number | null }
  | { step: 7; hasDebts: boolean; debtEntries: DebtOnboardingPayload['entries'] }
  | { step: 8; persona: OnboardingBudgetPersona }
  | { step: 9 }

function incomeRowsToEntries(rows: V2IncomeRow[]): Omit<IncomeSource, 'id' | 'createdAt'>[] {
  const out: Omit<IncomeSource, 'id' | 'createdAt'>[] = []
  for (const r of rows) {
    const name = r.name.trim()
    const n = parseFloat(r.amount.replace(/,/g, '.'))
    if (!name || !Number.isFinite(n) || n <= 0) continue
    out.push({
      name,
      amount: n,
      currency: r.currency,
      isRecurring: true,
      recurringFrequency: 'monthly',
      sourceType: 'other',
    })
  }
  return out
}

function replaceSubscriptionsFromPicks(
  picks: { brandKey: string; amount: number }[],
  baseCurrency: Currency,
  region: CatalogRegion | null,
) {
  const st = useFinanceStore.getState()
  for (const s of [...st.subscriptions]) {
    st.deleteSubscription(s.id)
  }
  const r: CatalogRegion = region ?? 'uae'
  const iso = new Date().toISOString().slice(0, 10)
  for (const p of picks) {
    if (!Number.isFinite(p.amount) || p.amount <= 0) continue
    const brand = findBrandByKey(p.brandKey)
    const plan = brand?.plans[r]?.[0]
    st.addSubscription({
      name: brand?.name ?? p.brandKey,
      brandKey: p.brandKey,
      planName: plan?.name ?? 'Standard',
      amount: p.amount,
      currency: baseCurrency,
      billingCycle: 'monthly',
      billingDay: 1,
      startDate: iso,
      paymentMethodId: null,
      expenseCategory: brand?.defaultCategory ?? 'Enjoyment',
      status: 'active',
      notes: null,
      nextBillingDate: null,
    })
  }
}

function paymentDraftsFromSelection(chipIds: V2PaymentChipId[], customNames: string[]): OnboardingPaymentDraft[] {
  const drafts: OnboardingPaymentDraft[] = []
  for (const id of chipIds) {
    const def = V2_PAYMENT_CHIPS.find((c) => c.id === id)
    if (!def) continue
    drafts.push({
      preset: `v2_${id}`,
      type: def.type,
      nickname: def.defaultLabel,
    })
  }
  let i = 0
  for (const raw of customNames) {
    const n = raw.trim()
    if (!n) continue
    drafts.push({
      preset: `v2_custom_${i++}`,
      type: 'other',
      nickname: n,
    })
  }
  return drafts
}

/**
 * Applies one V2 onboarding step to Zustand and returns the next merged answer bag.
 */
export function commitOnboardingV2Step(
  payload: V2CommitPayload,
  answers: Record<string, unknown>,
  redo: boolean,
): Record<string, unknown> {
  const next = { ...answers }
  const st = useFinanceStore.getState()

  switch (payload.step) {
    case 0: {
      const name = payload.displayName.trim().slice(0, 120)
      next.display_name = name
      st.updateProfile({ name })
      break
    }
    case 1: {
      const country = payload.country.trim()
      next.country = country
      st.updateProfile({ country })
      const guess = defaultCurrencyForCountry(country, st.profile.city)
      if (guess) {
        applyMapsTo('settings.baseCurrency', guess, st.updateProfile, st.updateSettings)
      }
      applyLocaleFromProfile()
      break
    }
    case 2: {
      const entries = incomeRowsToEntries(payload.incomeRows)
      next.income_entries = { entries }
      applyIncomeFromOnboarding(entries)
      break
    }
    case 3: {
      next.v2_fixed_bills = payload.fixedBills
      break
    }
    case 4: {
      const region = detectCatalogRegion(st.profile)
      replaceSubscriptionsFromPicks(
        payload.subscriptions,
        st.settings.baseCurrency as Currency,
        region,
      )
      break
    }
    case 5: {
      const drafts = paymentDraftsFromSelection(payload.payChipIds, payload.customNames)
      next.payment_methods = drafts
      applyPaymentDrafts(redo, drafts, st.settings.baseCurrency as Currency)
      break
    }
    case 6: {
      if (payload.monthlySavings != null && payload.monthlySavings > 0) {
        next.v2_monthly_savings = payload.monthlySavings
      } else {
        delete next.v2_monthly_savings
      }
      break
    }
    case 7: {
      next.v2_has_debts = payload.hasDebts
      if (!payload.hasDebts) {
        for (const d of [...st.debts]) st.deleteDebt(d.id)
        st.updateProfile({ noDebtsDeclared: true })
        next.debt_entries = { entries: [] }
      } else {
        st.updateProfile({ noDebtsDeclared: false })
        next.debt_entries = { entries: payload.debtEntries }
        applyDebtFromOnboarding(payload.debtEntries)
      }
      break
    }
    case 8: {
      next.onboarding_persona = payload.persona
      break
    }
    case 9:
      break
    default:
      break
  }

  return next
}

export function isLastOnboardingV2Step(index: number): boolean {
  return index >= ONBOARDING_V2_STEP_COUNT - 1
}
