import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Dictionary } from '@/lib/i18n/types'
import { parseSurveyConfig, type SurveyConfig } from '@/lib/onboarding/surveyConfig'
import { getExpertSurveyConfig } from '@/lib/onboarding/expertSurveyConfig'
import type {
  AppSettings,
  Currency,
  IncomeSource,
  OnboardingPaymentDraft,
  UserProfile,
} from '@/lib/store/types'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { defaultCurrencyForCountry } from '@/lib/profile/countryToCurrency'

export function applyMapsTo(
  mapsTo: string,
  value: string,
  updateProfile: (u: Partial<UserProfile>) => void,
  updateSettings: (u: Partial<AppSettings>) => void
) {
  if (mapsTo === 'profile.name') {
    updateProfile({ name: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'profile.country') {
    updateProfile({ country: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'profile.city') {
    updateProfile({ city: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'profile.gender') {
    if (value === 'male' || value === 'female' || value === 'prefer_not_to_say') {
      updateProfile({ gender: value })
    }
    return
  }
  if (mapsTo === 'settings.baseCurrency') {
    updateSettings({ baseCurrency: value as Currency })
    return
  }
  if (mapsTo === 'settings.secondaryCurrency') {
    if (value === 'none') {
      updateSettings({ secondaryCurrency: null, showSecondaryCurrency: false })
    } else {
      updateSettings({
        secondaryCurrency: value as Currency,
        showSecondaryCurrency: true,
      })
    }
  }
}

/**
 * When the user picks / updates their country or city in onboarding, cascade a
 * best-guess `baseCurrency` into settings AND retarget the pristine seed defaults
 * (cash payment method currency + empty budget category currency) so every post-
 * onboarding Add sheet defaults to the right currency without further clicks.
 *
 * Safe to call whenever `profile.country` or `profile.city` changes — it only rewrites
 * fields that are still at their pristine/empty state.
 */
export function applyLocaleFromProfile() {
  const st = useFinanceStore.getState()
  const { profile, settings, paymentMethods, budgetCategories } = st
  const derived = defaultCurrencyForCountry(profile.country, profile.city)
  if (!derived || derived === settings.baseCurrency) return

  const previousBase = settings.baseCurrency
  st.updateSettings({ baseCurrency: derived })

  // Retarget the default "Cash" payment method if still at the previous baseCurrency.
  const defaultCash = paymentMethods.find(
    (m) => m.type === 'cash' && m.currency === previousBase
  )
  if (defaultCash) {
    st.updatePaymentMethod(defaultCash.id, { currency: derived })
  }

  // Retarget any budget categories still at zero (pristine seed) to the new currency.
  const reseededBudget = budgetCategories.map((row) =>
    row.budgetedAmount === 0 && row.currency === previousBase
      ? { ...row, currency: derived }
      : row
  )
  if (reseededBudget.some((row, i) => row.currency !== budgetCategories[i].currency)) {
    st.setBudgetCategories(reseededBudget)
  }
}

export function applyIncomeFromOnboarding(entries: Omit<IncomeSource, 'id' | 'createdAt'>[]) {
  const st = useFinanceStore.getState()
  const { deleteIncomeSource, addIncomeSource, updateSettings } = st
  for (const s of st.incomeSources) {
    if (s.name === 'Primary income') deleteIncomeSource(s.id)
  }
  if (entries.length === 0) {
    const st2 = useFinanceStore.getState()
    const m = calculateMonthlyIncome(
      st2.incomeSources,
      st2.settings.baseCurrency,
      st2.exchangeRates
    )
    updateSettings({ noIncomeDeclared: m <= 0 })
    return
  }
  const ids = [...useFinanceStore.getState().incomeSources.map((s) => s.id)]
  for (const id of ids) deleteIncomeSource(id)
  for (const e of entries) addIncomeSource({ ...e })
  updateSettings({ noIncomeDeclared: false })
}

export function applyDebtFromOnboarding(entries: DebtOnboardingPayload['entries']) {
  if (entries.length === 0) return
  const st = useFinanceStore.getState()
  const { deleteDebt, addDebt } = st
  const ids = [...st.debts.map((d) => d.id)]
  for (const id of ids) deleteDebt(id)
  for (const e of entries) addDebt(e)
}

export function applyPaymentDrafts(redo: boolean, drafts: OnboardingPaymentDraft[], base: Currency) {
  const colors = ['#f87171', '#94a3b8', '#34d399', '#a78bfa', '#fbbf24', '#fb923c']
  const { paymentMethods, addPaymentMethod } = useFinanceStore.getState()
  const existing = new Set(paymentMethods.map((m) => m.name.toLowerCase().trim()))
  drafts.forEach((d, idx) => {
    const name = d.nickname.trim()
    if (!name) return
    const key = name.toLowerCase()
    if (existing.has(key)) return
    addPaymentMethod({
      name,
      type: d.type,
      currency: base,
      color: colors[idx % colors.length],
      isDefault: !redo && idx === 0,
    })
    existing.add(key)
  })
}

export function pickSurveyConfig(remote: unknown, t: Dictionary): SurveyConfig {
  const parsed = parseSurveyConfig(remote)
  if (parsed?.steps?.some((s) => s.id === 'pre_plan')) return parsed
  return getExpertSurveyConfig(t)
}

export function valueForTextStep(stepId: string, answers: Record<string, unknown>, profile: UserProfile): string {
  const a = answers[stepId]
  if (typeof a === 'string') return a
  if (stepId === 'display_name') return profile.name ?? ''
  if (stepId === 'country') return profile.country ?? ''
  if (stepId === 'city') return profile.city ?? ''
  return ''
}

export function valueForNumberStep(stepId: string, answers: Record<string, unknown>): string {
  const a = answers[stepId]
  if (typeof a === 'number') return String(a)
  if (typeof a === 'string' && a.trim()) return a
  return ''
}

export function parseIncomeEntriesAnswer(raw: unknown): Omit<IncomeSource, 'id' | 'createdAt'>[] {
  if (!raw || typeof raw !== 'object' || !('entries' in raw)) return []
  const e = (raw as { entries: unknown }).entries
  if (!Array.isArray(e)) return []
  return e as Omit<IncomeSource, 'id' | 'createdAt'>[]
}

export function parseDebtEntriesAnswer(raw: unknown): DebtOnboardingPayload['entries'] {
  if (!raw || typeof raw !== 'object' || !('entries' in raw)) return []
  const e = (raw as { entries: unknown }).entries
  if (!Array.isArray(e)) return []
  return e as DebtOnboardingPayload['entries']
}

export function valueForSingleStep(
  stepId: string,
  answers: Record<string, unknown>,
  store: ReturnType<typeof useFinanceStore.getState>
): string | null {
  const a = answers[stepId]
  if (typeof a === 'string') return a
  if (stepId === 'base_currency') return store.settings.baseCurrency
  if (stepId === 'secondary_currency') {
    return store.settings.secondaryCurrency ?? 'none'
  }
  if (stepId === 'gender') return store.profile.gender ?? null
  return null
}

export function valueForMultiStep(stepId: string, answers: Record<string, unknown>): string[] {
  const a = answers[stepId]
  if (Array.isArray(a) && a.every((x) => typeof x === 'string')) return a as string[]
  return []
}

export function valueForPaymentStep(answers: Record<string, unknown>): OnboardingPaymentDraft[] {
  const a = answers.payment_methods
  if (Array.isArray(a)) {
    return a.filter(
      (x): x is OnboardingPaymentDraft =>
        typeof x === 'object' &&
        x !== null &&
        'nickname' in x &&
        'type' in x &&
        'preset' in x
    ) as OnboardingPaymentDraft[]
  }
  return []
}
