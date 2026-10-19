import type { BudgetBlock, BudgetPlan, Currency } from '@/lib/store/types'
import { BUDGET_BLOCKS, blockTotals, percentOfIncome, planTotal } from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase, isSavingsPlanCategory } from '@/lib/budget/budgetPlans'

export interface PlanSummary {
  total: number
  /** Income minus every line. */
  free: number
  /** One entry per block in page order, as 0-100 shares of income, for a mini flow strip. */
  flow: { block: BudgetBlock; percent: number }[]
  /** Share of income that goes to savings movements, 0-100. */
  savingsRate: number
  everyday: number
  /** Debt money beyond the linked minimums (lines in the debts block that nobody links). */
  extraPayoff: number
  lineCount: number
}

/** The few numbers a plan card and the activation compare need, without building a whole PlanView. */
export function summarizePlan(plan: BudgetPlan, income: number, base: Currency, rates: Record<string, number>): PlanSummary {
  const totals = blockTotals(plan, base, rates)
  const total = planTotal(totals)
  const inBase = (amount: Parameters<typeof effectivePlanCategoryAmountInBase>[0]) =>
    effectivePlanCategoryAmountInBase(amount, base, rates)
  const savings = plan.categories.filter(isSavingsPlanCategory).reduce((s, c) => s + inBase(c), 0)
  const extraPayoff = plan.categories
    .filter((c) => c.block === 'debts' && (c.linkType ?? 'none') === 'none')
    .reduce((s, c) => s + inBase(c), 0)
  return {
    total,
    free: Math.round((income - total) * 100) / 100,
    flow: BUDGET_BLOCKS.map((block) => ({ block, percent: percentOfIncome(totals[block], income) })),
    savingsRate: percentOfIncome(savings, income),
    everyday: totals.everyday,
    extraPayoff,
    lineCount: plan.categories.length,
  }
}
