import type { FinanceStore } from '@/lib/store/types'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { totalPlannedExpensesForPlan } from '@/lib/budget/budgetPlans'
import { detectFundingScenario, getUsualKeep, type FundingScenario } from '@/lib/goals/fundingScenario'

type Slice = Pick<
  FinanceStore,
  'incomeEvents' | 'incomeSources' | 'expenses' | 'budgetCategories' | 'budgetPlans' | 'activeBudgetPlanId' | 'exchangeRates' | 'settings'
>

export interface FundingBasis {
  scenario: FundingScenario
  /** Monthly amount the user usually keeps (base currency); null = unknown. */
  usualKeep: number | null
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Scenario (A/B/C) and the usual monthly keep, from real data. Base currency. */
export function fundingBasis(s: Slice, now: Date): FundingBasis {
  const base = s.settings.baseCurrency
  const current = monthKey(now)
  const scenario = detectFundingScenario({
    incomeEvents: s.incomeEvents,
    budgetCategories: s.budgetCategories,
    budgetPlanCount: s.budgetPlans.length,
    currentMonth: current,
  })

  const plan = selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)
  const planned = plan
    ? totalPlannedExpensesForPlan(plan, base, s.exchangeRates)
    : s.budgetCategories.reduce((sum, c) => sum + convertCurrency(c.budgetedAmount, c.currency, base, s.exchangeRates), 0)
  const budgetSavings =
    scenario === 'A' ? calculateMonthlyIncome(s.incomeSources, base, s.exchangeRates) - planned : undefined

  const months = [1, 2, 3].map((i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1))).reverse()
  const monthlyNets = months.flatMap((m) => {
    const income = s.incomeEvents
      .filter((e) => e.status === 'confirmed' && e.receivedDate.startsWith(m))
      .reduce((sum, e) => sum + convertCurrency(e.amount, e.currency, base, s.exchangeRates), 0)
    if (income === 0) return []
    const spend = s.expenses
      .filter((e) => e.date.startsWith(m) && e.category !== 'Savings')
      .reduce((sum, e) => sum + e.amountInBaseCurrency, 0)
    return [income - spend]
  })

  return { scenario, usualKeep: getUsualKeep({ scenario, budgetSavings, monthlyNets }) }
}
