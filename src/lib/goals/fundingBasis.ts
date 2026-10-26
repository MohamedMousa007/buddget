import type { FinanceStore } from '@/lib/store/types'
import {
  actualIncomeForMonth,
  budgetMonthKeyFor,
  expenseAmountInBase,
  filterExpensesByMonth,
  projectedIncomeForMonth,
} from '@/lib/utils/calculations'
import { shiftMonth } from '@/lib/budget/lineSpend'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
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

/** Scenario (A/B/C) and the usual monthly keep, from real data. Base currency. */
export function fundingBasis(s: Slice, now: Date): FundingBasis {
  const base = s.settings.baseCurrency
  const startDay = s.settings.monthStartDay
  const current = budgetMonthKeyFor(now, startDay)
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
    scenario === 'A' ? projectedIncomeForMonth(s.incomeSources, base, s.exchangeRates, current, startDay) - planned : undefined

  const months = [3, 2, 1].map((i) => shiftMonth(current, -i))
  const monthlyNets = months.flatMap((m) => {
    const spendRows = filterExpensesByMonth(s.expenses, m, startDay).filter((e) => !isNonSpendExpense(e))
    const income = actualIncomeForMonth(s.incomeSources, s.incomeEvents, base, s.exchangeRates, m, startDay)
    if (income === 0 || spendRows.length === 0) return []
    return [income - spendRows.reduce((sum, e) => sum + expenseAmountInBase(e, base, s.exchangeRates), 0)]
  })

  return { scenario, usualKeep: getUsualKeep({ scenario, budgetSavings, monthlyNets }) }
}
