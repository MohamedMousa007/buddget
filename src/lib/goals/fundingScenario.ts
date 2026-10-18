import type { BudgetCategory, IncomeEvent } from '@/lib/store/types'

export type FundingScenario = 'A' | 'B' | 'C'

export interface FundingScenarioInput {
  incomeEvents: Pick<IncomeEvent, 'receivedDate' | 'status'>[]
  budgetCategories: Pick<BudgetCategory, 'budgetedAmount'>[]
  budgetPlanCount: number
  /** `YYYY-MM` of the current month; income in it does not count as a full month. */
  currentMonth: string
}

/** A: budget + income. B: income history only. C: nothing yet. Only changes copy, never disables an option. */
export function detectFundingScenario(s: FundingScenarioInput): FundingScenario {
  const hasIncome = s.incomeEvents.some(
    (e) => e.status === 'confirmed' && e.receivedDate.slice(0, 7) < s.currentMonth,
  )
  const hasBudget = s.budgetPlanCount > 0 || s.budgetCategories.some((c) => c.budgetedAmount > 0)
  if (hasBudget && hasIncome) return 'A'
  return hasIncome ? 'B' : 'C'
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface UsualKeepInput {
  scenario: FundingScenario
  /** A: income minus budgeted spending for a month. */
  budgetSavings?: number
  /** Net savings (income − spend) of recent full months, newest last. */
  monthlyNets: number[]
  /** Counselor shows the figure only after this many full months. */
  minMonths?: number
}

/** Monthly amount the user usually keeps, or null when unknown (hides the meter tick). */
export function getUsualKeep({ scenario, budgetSavings, monthlyNets, minMonths = 1 }: UsualKeepInput): number | null {
  if (scenario === 'A' && budgetSavings !== undefined) return Math.max(0, budgetSavings)
  if (scenario === 'C' || monthlyNets.length < minMonths) return null
  return Math.max(0, median(monthlyNets.slice(-3)))
}
