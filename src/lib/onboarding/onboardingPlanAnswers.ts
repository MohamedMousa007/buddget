/**
 * Typed finance snapshot used when building the terminal AI budget plan.
 * Replaces the retired Journey card layer — only the answer shape remains.
 */

import type { ParsedBudgetInput } from '@/lib/ai/parseBudgetInput'
import type {
  AppSettings,
  Currency,
  Debt,
  DebtRecurringFrequency,
  FinanceStore,
  GoalCategory,
  IncomeSource,
  PaymentMethod,
  SavingsAccount,
  Subscription,
  UserProfile,
} from '@/lib/store/types'

interface BaseDraft {
  clientDraftId: string
}

export type PaymentMethodDraft = BaseDraft &
  Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'> & {
    openingBalanceOwed?: number
  }

export type IncomeSourceDraft = BaseDraft &
  Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt' | 'paymentMethodId'> & {
    paymentMethodClientDraftId?: string
  }

export type DebtDraft = BaseDraft &
  Omit<Debt, 'id' | 'createdAt' | 'updatedAt'> & {
    recurringPayment?: {
      amount: number
      currency: Currency | 'XAU'
      frequency: DebtRecurringFrequency
      nextDueDate: string
      paymentMethodClientDraftId: string
    }
  }

export type SubscriptionDraft = BaseDraft &
  Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'linkedRecurringExpenseId'> & {
    paymentMethodClientDraftId: string
  }

export type SavingsAccountDraft = BaseDraft &
  Omit<SavingsAccount, 'id' | 'createdAt' | 'updatedAt'> & {
    openingBalance?: number
    recurringDeposit?: {
      amount: number
      currency: Currency
      dayOfMonth: number
      frequency: 'monthly' | 'biweekly' | 'weekly'
    }
  }

export interface GoalDraft extends BaseDraft {
  name: string
  category: GoalCategory
  targetAmount: number
  currency: Currency
  targetDate?: string
  linkedSavingsAccountClientDraftIds?: string[]
  linkedDebtClientDraftIds?: string[]
}

export interface BudgetPlanCategoryDraft {
  name: string
  icon?: string
  amount: number
  currency: Currency
  subcategories?: Array<{ name: string; amount: number }>
}

export interface OnboardingPlanAnswers {
  journeyMode?: 'quick' | 'guided'
  identity: {
    displayName?: string
    country?: string
    city?: string
    baseCurrency?: Currency
    secondaryCurrency?: Currency | null
    household?: 'solo' | 'couple' | 'family'
  }
  aiSeed?: ParsedBudgetInput
  moneyIn: {
    paymentMethods: PaymentMethodDraft[]
    incomeSources: IncomeSourceDraft[]
  }
  moneyOut: {
    hasDebts?: 'yes' | 'no'
    hasSubscriptions?: 'yes' | 'no'
    debts: DebtDraft[]
    subscriptions: SubscriptionDraft[]
  }
  future: {
    hasSavings?: 'yes' | 'no'
    savingsAccounts: SavingsAccountDraft[]
    goals: GoalDraft[]
  }
  aiPlan?: {
    categories: BudgetPlanCategoryDraft[]
    source: 'ai' | 'preset'
    acceptedAt?: string
  }
}

export function emptyOnboardingPlanAnswers(): OnboardingPlanAnswers {
  return {
    identity: {},
    moneyIn: { paymentMethods: [], incomeSources: [] },
    moneyOut: { debts: [], subscriptions: [] },
    future: { savingsAccounts: [], goals: [] },
  }
}

/** Heuristic household label from expert survey answer keys (flat bag). */
export function deriveHouseholdFromSurveyAnswers(
  survey: Record<string, unknown>,
): 'solo' | 'couple' | 'family' {
  const rel = survey.relationship_status
  if (rel === 'partnered') return 'couple'
  const dep = survey.dependents
  if (dep === 'three_plus' || dep === 'two') return 'family'
  if (dep === 'one') return 'couple'
  const living = survey.living_situation
  if (living === 'with_parents') return 'family'
  return 'solo'
}

interface LegacyAnswersV2 {
  display_name?: unknown
  country?: unknown
  city?: unknown
  base_currency?: unknown
  secondary_currency?: unknown
}

function asTrimmedString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function asCurrency(v: unknown): Currency | undefined {
  if (typeof v !== 'string') return undefined
  const upper = v.trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(upper)) return upper as Currency
  return undefined
}

/** Idempotent: flat survey / core-gate answers → plan-shaped identity scaffold. */
export function migrateSurveyAnswersToPlanShape(
  legacy: Record<string, unknown> | undefined | null,
): OnboardingPlanAnswers {
  const next = emptyOnboardingPlanAnswers()
  if (!legacy) return next

  const l = legacy as LegacyAnswersV2

  const name = asTrimmedString(l.display_name)
  if (name) next.identity.displayName = name

  const country = asTrimmedString(l.country)
  if (country) next.identity.country = country

  const city = asTrimmedString(l.city)
  if (city) next.identity.city = city

  const base = asCurrency(l.base_currency)
  if (base) next.identity.baseCurrency = base

  next.identity.household = deriveHouseholdFromSurveyAnswers(legacy)
  return next
}

export function isOnboardingPlanAnswersShape(answers: unknown): answers is OnboardingPlanAnswers {
  if (!answers || typeof answers !== 'object') return false
  const a = answers as Partial<OnboardingPlanAnswers>
  return (
    a.identity !== undefined &&
    a.moneyIn !== undefined &&
    a.moneyOut !== undefined &&
    a.future !== undefined
  )
}

function mergeIdentityFromProfile(
  base: OnboardingPlanAnswers,
  profile: UserProfile,
  settings: AppSettings,
  surveyAnswers: Record<string, unknown>,
): OnboardingPlanAnswers {
  const household = base.identity.household ?? deriveHouseholdFromSurveyAnswers(surveyAnswers)
  return {
    ...base,
    identity: {
      ...base.identity,
      displayName: base.identity.displayName ?? (profile.name?.trim() || undefined),
      country: base.identity.country ?? (profile.country?.trim() || undefined),
      city: base.identity.city ?? (profile.city?.trim() || undefined),
      baseCurrency: base.identity.baseCurrency ?? settings.baseCurrency,
      secondaryCurrency:
        base.identity.secondaryCurrency !== undefined ?
          base.identity.secondaryCurrency
        : settings.secondaryCurrency,
      household,
    },
  }
}

/**
 * Typed input for `buildAiPlanContext` from store + persisted onboarding answers.
 */
export function buildPlanAnswersFromStore(state: FinanceStore): OnboardingPlanAnswers {
  const raw = state.onboardingState.answers
  const surveyBag =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  if (isOnboardingPlanAnswersShape(raw)) {
    return mergeIdentityFromProfile(raw, state.profile, state.settings, surveyBag)
  }
  const migrated = migrateSurveyAnswersToPlanShape(surveyBag)
  return mergeIdentityFromProfile(migrated, state.profile, state.settings, surveyBag)
}
