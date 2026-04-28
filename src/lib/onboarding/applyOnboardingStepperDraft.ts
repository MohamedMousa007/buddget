import type { DebtOnboardingPayload } from '@/lib/onboarding/debtOnboardingTypes'
import {
  applyDebtFromOnboarding,
  applyIncomeFromOnboarding,
  applyLocaleFromProfile,
  applyMapsTo,
  applyPaymentDrafts,
} from '@/lib/onboarding/onboardingPageHelpers'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'
import { clampDebtFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, DebtCurrency, IncomeSource, OnboardingPaymentDraft } from '@/lib/store/types'
import { ONBOARDING_V2_STEP_COUNT } from '@/lib/onboarding/v2/constants'
import type { OnboardingDraft } from '@/lib/onboarding/onboardingDraft'

export const ONBOARDING_COMPLETE_KEY = 'buddget-onboarding-complete'

function incomeFromDraft(draft: OnboardingDraft): Omit<IncomeSource, 'id' | 'createdAt'>[] {
  return draft.incomeSources
    .filter((i) => i.name.trim() && Number.isFinite(i.amount) && i.amount > 0)
    .map((i) => ({
      name: i.name.trim(),
      amount: i.amount,
      currency: i.currency,
      isRecurring: i.isRecurring,
      recurringFrequency: 'monthly' as const,
      sourceType: 'other' as const,
    }))
}

function paymentDraftsFromDraft(draft: OnboardingDraft): OnboardingPaymentDraft[] {
  return draft.paymentMethods
    .filter((p) => p.name.trim())
    .map((p, idx) => ({
      preset: `stepper_${p.type}_${idx}`,
      type: p.type,
      nickname: p.name.trim(),
    }))
}

function debtEntriesFromDraft(draft: OnboardingDraft): DebtOnboardingPayload['entries'] {
  const st = useFinanceStore.getState()
  return draft.debts
    .filter((d) => d.name.trim() && d.person.trim() && Number.isFinite(d.startingBalance))
    .map((d) => ({
      name: d.name.trim(),
      person: d.person.trim(),
      startingBalance: d.startingBalance,
      currency: (d.isGold ?
        'XAU'
      : clampDebtFiatToAllowed(st.settings, (d.currency || st.settings.baseCurrency) as Currency)) as DebtCurrency,
      isGold: d.isGold,
      goldKarat: d.isGold ? (d.goldKarat ?? 24) : undefined,
    }))
}

/**
 * Writes stepper draft into Zustand + onboarding answers shape expected by budget preview.
 */
export function applyOnboardingStepperDraft(draft: OnboardingDraft): void {
  const fs0 = useFinanceStore.getState()
  const base = (draft.baseCurrency || fs0.settings.baseCurrency) as Currency

  const name = draft.name.trim().slice(0, 120)
  if (name) {
    fs0.updateProfile({ name })
  }

  const country = draft.country.trim()
  if (country) {
    fs0.updateProfile({ country })
    const guess = defaultCurrencyForCountry(country, fs0.profile.city)
    if (guess) {
      applyMapsTo('settings.baseCurrency', guess, fs0.updateProfile, fs0.updateSettings)
    }
  }

  const fs1 = useFinanceStore.getState()
  if (draft.baseCurrency && draft.baseCurrency !== fs1.settings.baseCurrency) {
    fs1.updateSettings({ baseCurrency: draft.baseCurrency })
  }

  applyLocaleFromProfile()

  applyIncomeFromOnboarding(incomeFromDraft(draft))

  const fs2 = useFinanceStore.getState()
  for (const s of [...fs2.subscriptions]) {
    fs2.deleteSubscription(s.id)
  }
  const iso = new Date().toISOString().slice(0, 10)
  for (const sub of draft.subscriptions) {
    if (!sub.name.trim() || !Number.isFinite(sub.amount) || sub.amount <= 0) continue
    useFinanceStore.getState().addSubscription({
      name: sub.name.trim(),
      brandKey: null,
      planName: null,
      amount: sub.amount,
      currency: base,
      billingCycle: 'monthly',
      billingDay: 1,
      startDate: iso,
      paymentMethodId: null,
      expenseCategory: 'Enjoyment',
      status: 'active',
      notes: null,
      nextBillingDate: null,
    })
  }

  const fs3 = useFinanceStore.getState()
  const pmDrafts = paymentDraftsFromDraft(draft)
  if (pmDrafts.length > 0) {
    applyPaymentDrafts(false, pmDrafts, fs3.settings.baseCurrency as Currency)
  }

  const debtEntries = debtEntriesFromDraft(draft)
  const fs4 = useFinanceStore.getState()
  if (debtEntries.length === 0) {
    for (const d of [...fs4.debts]) {
      fs4.deleteDebt(d.id)
    }
    fs4.updateProfile({ noDebtsDeclared: true })
  } else {
    fs4.updateProfile({ noDebtsDeclared: false })
    applyDebtFromOnboarding(debtEntries)
  }

  const stepperExtra = draft.fixedCosts
    .filter((f) => f.name.trim() && Number.isFinite(f.amount) && f.amount > 0)
    .map((f) => ({ name: f.name.trim(), amount: f.amount }))

  const fs5 = useFinanceStore.getState()
  const mergedAnswers: Record<string, unknown> = {
    ...fs5.onboardingState.answers,
    display_name: name || undefined,
    country: country || undefined,
    base_currency: draft.baseCurrency,
    stepper_fixed_extra: stepperExtra,
    onboarding_persona: draft.budgetStyle,
    v2_has_debts: debtEntries.length > 0,
    debt_entries: { entries: debtEntries },
  }

  if (draft.savingsGoal != null && draft.savingsGoal > 0) {
    mergedAnswers.v2_monthly_savings = draft.savingsGoal
  } else {
    delete mergedAnswers.v2_monthly_savings
  }

  fs5.setOnboardingState({
    answers: mergedAnswers,
    currentStepIndex: ONBOARDING_V2_STEP_COUNT,
  })
}
