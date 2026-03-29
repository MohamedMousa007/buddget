import type { Dictionary } from '@/lib/i18n/types'
import type {
  BudgetCategory,
  Debt,
  FinanceStore,
  IncomeSource,
  OnboardingState,
  PaymentMethod,
  UserProfile,
} from '@/lib/store/types'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { defaultOnboardingState, ONBOARDING_FLOW_VERSION } from '@/lib/onboarding/onboardingTypes'

export type OnboardingStageId =
  | 'personal'
  | 'income'
  | 'costs'
  | 'debts'
  | 'lifestyle'
  | 'payments'
  | 'plan'

export type OnboardingStageStatus = 'complete' | 'pending'

export interface OnboardingStageRow {
  id: OnboardingStageId
  label: string
  description: string
  status: OnboardingStageStatus
}

const LIFESTYLE_KEYS = [
  'financial_goals',
  'priority_focus',
  'spending_style',
  'food_profile',
  'transport_profile',
  'living_situation',
  'employment_type',
] as const

function str(a: unknown): string {
  return typeof a === 'string' ? a.trim() : ''
}

function hasPersonalData(profile: UserProfile, answers: Record<string, unknown>): boolean {
  const name = str(answers.display_name) || profile.name?.trim()
  const country = str(answers.country) || profile.country?.trim()
  const city = str(answers.city) || profile.city?.trim()
  return !!(name && country && city)
}

function hasIncomeData(
  answers: Record<string, unknown>,
  incomeSources: IncomeSource[],
  base: string,
  exchangeRates: Record<string, number>
): boolean {
  if (calculateMonthlyIncome(incomeSources, base as never, exchangeRates) > 0) return true
  const reg = answers.income_regularity
  if (typeof reg === 'string' && reg && reg !== 'none') return true
  const raw = answers.income_entries
  if (raw && typeof raw === 'object' && 'entries' in raw) {
    const e = (raw as { entries: unknown }).entries
    if (Array.isArray(e) && e.length > 0) return true
  }
  return false
}

function hasCostsData(answers: Record<string, unknown>, budgetCategories: BudgetCategory[]): boolean {
  const h = answers.housing_monthly
  if (typeof h === 'number' && h > 0) return true
  if (answers.subscriptions_detail != null && String(answers.subscriptions_detail).trim() !== '') return true
  return budgetCategories.some((b) => b.budgetedAmount > 0)
}

function hasDebtsData(answers: Record<string, unknown>, debts: Debt[]): boolean {
  if (debts.length > 0) return true
  const sit = answers.debt_situation
  if (typeof sit === 'string' && sit.trim()) return true
  const raw = answers.debt_entries
  if (raw && typeof raw === 'object' && 'entries' in raw) {
    const e = (raw as { entries: unknown }).entries
    if (Array.isArray(e)) return e.length > 0
  }
  return false
}

function lifestyleAnsweredCount(answers: Record<string, unknown>): number {
  let n = 0
  for (const k of LIFESTYLE_KEYS) {
    const v = answers[k]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && !v.trim()) continue
    if (Array.isArray(v) && v.length === 0) continue
    n += 1
  }
  return n
}

function hasLifestyleData(answers: Record<string, unknown>, budgetCategories: BudgetCategory[]): boolean {
  if (lifestyleAnsweredCount(answers) >= 4) return true
  const withBudget = budgetCategories.filter((b) => b.budgetedAmount > 0).length
  return withBudget >= 3
}

function hasPaymentsData(answers: Record<string, unknown>, paymentMethods: PaymentMethod[]): boolean {
  const raw = answers.payment_methods
  if (Array.isArray(raw) && raw.length > 0) return true
  if (paymentMethods.length > 1) return true
  return paymentMethods.some((m) => m.name.trim().toLowerCase() !== 'cash')
}

export function isPlanStageComplete(onboarding: OnboardingState | undefined): boolean {
  const ob = onboarding ?? defaultOnboardingState()
  return ob.flowVersion >= ONBOARDING_FLOW_VERSION && ob.planAccepted === true
}

export type OnboardingProgressSnapshot = {
  profile: UserProfile
  onboardingState: OnboardingState
  incomeSources: IncomeSource[]
  budgetCategories: BudgetCategory[]
  debts: Debt[]
  paymentMethods: PaymentMethod[]
  exchangeRates: Record<string, number>
  settings: { baseCurrency: string }
}

export function getOnboardingStageRows(snap: OnboardingProgressSnapshot, t: Dictionary): OnboardingStageRow[] {
  const { profile, onboardingState, incomeSources, budgetCategories, debts, paymentMethods, exchangeRates, settings } =
    snap
  const answers = onboardingState.answers
  const base = settings.baseCurrency
  const o = t.onboarding

  const personal = hasPersonalData(profile, answers)
  const income = hasIncomeData(answers, incomeSources, base, exchangeRates)
  const costs = hasCostsData(answers, budgetCategories)
  const debtsDone = hasDebtsData(answers, debts)
  const lifestyle = hasLifestyleData(answers, budgetCategories)
  const payments = hasPaymentsData(answers, paymentMethods)
  const plan = isPlanStageComplete(onboardingState)

  const rows: OnboardingStageRow[] = [
    {
      id: 'personal',
      label: o.stagePersonal,
      description: o.stagePersonalDesc,
      status: personal ? 'complete' : 'pending',
    },
    {
      id: 'income',
      label: o.stageIncome,
      description: o.stageIncomeDesc,
      status: income ? 'complete' : 'pending',
    },
    {
      id: 'costs',
      label: o.stageCosts,
      description: o.stageCostsDesc,
      status: costs ? 'complete' : 'pending',
    },
    {
      id: 'debts',
      label: o.stageDebts,
      description: o.stageDebtsDesc,
      status: debtsDone ? 'complete' : 'pending',
    },
    {
      id: 'lifestyle',
      label: o.stageLifestyle,
      description: o.stageLifestyleDesc,
      status: lifestyle ? 'complete' : 'pending',
    },
    {
      id: 'payments',
      label: o.stagePayments,
      description: o.stagePaymentsDesc,
      status: payments ? 'complete' : 'pending',
    },
    {
      id: 'plan',
      label: o.stagePlan,
      description: o.stagePlanDesc,
      status: plan ? 'complete' : 'pending',
    },
  ]
  return rows
}

/**
 * 0–100: blends survey answers with real app data (income, budgets, debts, methods).
 * 100 only when the plan stage is complete (accepted plan or manual finish).
 */
export function getOnboardingCompletionPercentFromSnapshot(snap: OnboardingProgressSnapshot, t: Dictionary): number {
  if (isPlanStageComplete(snap.onboardingState)) return 100
  const rows = getOnboardingStageRows(snap, t)
  const done = rows.filter((r) => r.status === 'complete').length
  const total = rows.length
  if (total === 0) return 0
  return Math.min(99, Math.round((done / total) * 100))
}

export function onboardingProgressSnapshotFromStore(
  s: Pick<
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
): OnboardingProgressSnapshot {
  return {
    profile: s.profile,
    onboardingState: s.onboardingState,
    incomeSources: s.incomeSources,
    budgetCategories: s.budgetCategories,
    debts: s.debts,
    paymentMethods: s.paymentMethods,
    exchangeRates: s.exchangeRates,
    settings: { baseCurrency: s.settings.baseCurrency },
  }
}
