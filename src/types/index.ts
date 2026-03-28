/**
 * Shared domain types — prefer importing from `@/types` in UI; store models stay in `@/lib/store/types`.
 */
export type {
  Currency,
  Expense,
  IncomeSource,
  BudgetCategory,
  Debt,
  UserProfile,
  AppSettings,
  OnboardingAiPlan,
  OnboardingPaymentDraft,
} from '@/lib/store/types'

export type {
  AdminConfig,
  AdminUserRow,
  AdminAnalyticsSnapshot,
  AdminSurveyRow,
  AiRuntimeSlice,
} from './admin'
