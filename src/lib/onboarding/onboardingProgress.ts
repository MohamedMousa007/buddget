import type { Dictionary } from '@/lib/i18n/types'
import type { OnboardingState } from '@/lib/store/types'
import type { FinanceStore } from '@/lib/store/types'
import {
  getOnboardingCompletionPercentFromSnapshot,
  getOnboardingStageRows,
  isPlanStageComplete,
  onboardingProgressSnapshotFromStore,
  type OnboardingProgressSnapshot,
} from '@/lib/onboarding/onboardingStages'

export { getOnboardingStageRows, onboardingProgressSnapshotFromStore, type OnboardingProgressSnapshot }

/** Top-level expert onboarding step ids (one per progress segment URL). */
export const EXPERT_SURVEY_STEP_IDS: string[] = [
  'expert_welcome',
  'profile_place',
  'life_money_basics',
  'income_entries',
  'housing_debt_context',
  'debt_entries',
  'goals_combined',
  'subs_and_savings',
  'lifestyle_rhythm',
  'payment_methods',
] as const

export function isExpertOnboardingComplete(onboarding: OnboardingState | undefined): boolean {
  return isPlanStageComplete(onboarding)
}

export type OnboardingProgressStoreSlice = Pick<
  FinanceStore,
  | 'profile'
  | 'onboardingState'
  | 'incomeSources'
  | 'budgetCategories'
  | 'debts'
  | 'paymentMethods'
  | 'exchangeRates'
  | 'settings'
>

/** 0–100: blends survey answers with income, budgets, debts, and payment methods already in the app. */
export function getOnboardingCompletionPercent(store: OnboardingProgressStoreSlice, t: Dictionary): number {
  return getOnboardingCompletionPercentFromSnapshot(onboardingProgressSnapshotFromStore(store), t)
}

export function expertSurveyStepCount(): number {
  return EXPERT_SURVEY_STEP_IDS.length
}
