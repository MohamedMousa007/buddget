import { resolveBudgetKey } from '@/lib/budget/budgetPlans'

export interface CategoryBudget {
  /** The plan row the category counts toward (Groceries can fold into Food). */
  row: string
  cap: number
  spent: number
  left: number
  /** Spent ÷ cap. */
  pct: number
}

/** This month's budget for an expense category, through the plan row that covers it; `null` with no positive cap. */
export function categoryBudget(
  category: string,
  caps: Readonly<Record<string, number>>,
  rowSpent: Readonly<Record<string, number>>,
): CategoryBudget | null {
  const row = resolveBudgetKey(category, Object.keys(caps))
  const cap = row == null ? 0 : caps[row] ?? 0
  if (row == null || !(cap > 0)) return null
  const spent = rowSpent[row] ?? 0
  return { row, cap, spent, left: cap - spent, pct: spent / cap }
}
