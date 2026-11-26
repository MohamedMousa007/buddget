import { isReportSpendRow } from '@/lib/constants/categoryMeta'
import type { BudgetPlanCategory, Currency, Expense } from '@/lib/store/types'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'
import { shiftMonth } from '@/lib/budget/lineSpend'

/** How far the three months may spread around their mean and still read as "high confidence". */
const STEADY = 0.15

export interface LineHistory {
  /** What the line's categories cost in each of the last complete months that had any, oldest first (base). */
  months: number[]
  steady: boolean
}

/**
 * What a line cost in the last three complete months before `cycleKey`, from the ledger: its own categories, or its
 * name when it has none. Null when none of those months has any spend, so the sheet shows no sizing note.
 */
export function lineHistory(
  line: Pick<BudgetPlanCategory, 'name' | 'expenseCategories'>,
  expenses: Expense[],
  cycleKey: string,
  monthStartDay: number,
  base: Currency,
  rates: Record<string, number>,
): LineHistory | null {
  const cats = new Set((line.expenseCategories?.length ? line.expenseCategories : [line.name]).map((c) => c.trim().toLowerCase()))
  const months: number[] = []
  for (const back of [3, 2, 1]) {
    const total = filterExpensesByMonth(expenses, shiftMonth(cycleKey, -back), monthStartDay)
      .filter((e) => isReportSpendRow(e) && cats.has(String(e.category).trim().toLowerCase()))
      .reduce((s, e) => s + expenseAmountInBase(e, base, rates), 0)
    if (total > 0) months.push(Math.round(total))
  }
  if (months.length === 0) return null
  const mean = months.reduce((s, x) => s + x, 0) / months.length
  const steady = months.length === 3 && months.every((x) => Math.abs(x - mean) <= mean * STEADY)
  return { months, steady }
}
