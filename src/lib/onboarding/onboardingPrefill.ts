import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import type { FinanceStore, OnboardingPaymentDraft } from '@/lib/store/types'

type StoreSlice = Pick<
  FinanceStore,
  'profile' | 'settings' | 'incomeSources' | 'debts' | 'paymentMethods' | 'exchangeRates'
>

/** Derive survey answer-shaped defaults from existing finance data (for redo / resume). */
export function deriveAnswersFromFinanceStore(state: StoreSlice): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (state.profile.name?.trim()) out.display_name = state.profile.name.trim()
  if (state.profile.country?.trim()) out.country = state.profile.country.trim()
  if (state.profile.city?.trim()) out.city = state.profile.city.trim()

  out.base_currency = state.settings.baseCurrency
  out.secondary_currency = state.settings.secondaryCurrency
    ? state.settings.secondaryCurrency
    : 'none'

  const monthly = calculateMonthlyIncome(
    state.incomeSources,
    state.settings.baseCurrency,
    state.exchangeRates
  )
  if (monthly > 0) {
    out.income_entries = {
      /* eslint-disable @typescript-eslint/no-unused-vars -- omit sync fields from draft payload */
      entries: state.incomeSources.map(({ id, createdAt, ...rest }) => rest),
      /* eslint-enable @typescript-eslint/no-unused-vars */
    }
    out.income_regularity = state.settings.noIncomeDeclared ? 'none' : 'stable_monthly'
  } else if (state.settings.noIncomeDeclared) {
    out.income_regularity = 'none'
  }

  if (state.debts.length > 0) {
    out.debt_entries = {
      /* eslint-disable @typescript-eslint/no-unused-vars -- omit sync fields from draft payload */
      entries: state.debts.map(({ id, createdAt, ...rest }) => rest),
      /* eslint-enable @typescript-eslint/no-unused-vars */
    }
  }

  const drafts: OnboardingPaymentDraft[] = state.paymentMethods.map((m) => ({
    preset: m.type === 'other' ? 'custom' : m.type,
    type: m.type,
    nickname: m.name,
  }))
  if (drafts.length > 0) {
    out.payment_methods = drafts
  }

  return out
}

export function mergeOnboardingAnswers(
  persisted: Record<string, unknown>,
  derived: Record<string, unknown>
): Record<string, unknown> {
  return { ...derived, ...persisted }
}
