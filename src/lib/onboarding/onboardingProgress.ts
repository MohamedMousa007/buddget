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

/** Survey-only step ids used for journey bar (excludes plan picker). */
export const EXPERT_SURVEY_STEP_IDS: string[] = [
  'expert_welcome',
  'display_name',
  'country',
  'city',
  'living_situation',
  'relationship_status',
  'dependents',
  'employment_type',
  'base_currency',
  'secondary_currency',
  'income_regularity',
  'income_entries',
  'housing_monthly',
  'debt_situation',
  'debt_entries',
  'financial_goals',
  'priority_focus',
  'spending_style',
  'transport_profile',
  'food_profile',
  'subscriptions_detail',
  'savings_orientation',
  'payment_methods',
  'pre_plan',
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
