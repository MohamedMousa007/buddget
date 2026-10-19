import type { BudgetPlan, Currency, Expense } from '@/lib/store/types'
import {
  categorySpendingForPlanRows,
  effectivePlanCategoryAmountInBase,
  isSavingsPlanCategory,
  otherRowName,
  unassignedSpend,
} from '@/lib/budget/budgetPlans'
import { calculateCategorySpending, filterExpensesByMonth } from '@/lib/utils/calculations'

export interface LineSpendInput {
  plan: BudgetPlan
  /** Ledger spend by expense category (base), as `calculateCategorySpending` returns it. */
  spendingByEnum: Record<string, number>
  /** Payments made this cycle per debt id (base); debt lines linked to a debt read these. */
  debtPaid: Record<string, number>
}

export interface LineSpend {
  byLine: Record<string, number>
  /** Spend in categories no line claims. The plan's Other line absorbs it, as the stats do. */
  unassigned: number
}

/**
 * Spend per plan line. A line with `expenseCategories` owns exactly those categories (first line in
 * plan order wins a shared one); a line without them is matched by name like the dashboard does;
 * a debt line linked to a debt reads that debt's payments.
 */
export function spendByLine({ plan, spendingByEnum, debtPaid }: LineSpendInput): LineSpend {
  const lines = plan.categories.filter((c) => !isSavingsPlanCategory(c) && c.name.trim())
  const remaining = new Map(Object.entries(spendingByEnum).map(([k, v]) => [k.toLowerCase(), { key: k, amount: v }]))
  const byLine: Record<string, number> = {}

  for (const l of lines) {
    if (l.linkType === 'debts' && l.linkIds?.length) {
      byLine[l.id] = l.linkIds.reduce((s, id) => s + (debtPaid[id] ?? 0), 0)
    } else if (l.expenseCategories?.length) {
      byLine[l.id] = 0
      for (const c of l.expenseCategories) {
        const hit = remaining.get(c.toLowerCase())
        if (!hit) continue
        byLine[l.id] += hit.amount
        remaining.delete(c.toLowerCase())
      }
    }
  }

  const byName = lines.filter((l) => !(l.id in byLine))
  const left = Object.fromEntries([...remaining.values()].map((r) => [r.key, r.amount]))
  const byNameSpend = categorySpendingForPlanRows(left, { ...plan, categories: byName })
  for (const l of byName) byLine[l.id] = byNameSpend[l.name.trim()] ?? 0

  const nameRows = byName.map((l) => l.name.trim())
  const unassigned = Object.values(unassignedSpend(left, nameRows)).reduce((s, v) => s + v, 0)
  const other = otherRowName(lines.map((l) => l.name.trim()))
  if (other && unassigned > 0) {
    const row = lines.find((l) => l.name.trim() === other)
    if (row) byLine[row.id] += unassigned
  }
  return { byLine, unassigned }
}

const HISTORY_CYCLES = 6
const AVERAGE_CYCLES = 3

export interface LineHistoryInput {
  plan: BudgetPlan
  expenses: Expense[]
  /** The selected cycle (`YYYY-MM`); history is the cycles before it. */
  monthKey: string
  monthStartDay: number
  base: Currency
  rates: Record<string, number>
  debtPaidForMonth: (monthKey: string) => Record<string, number>
}

export interface LineHistory {
  /** Mean spend of the last three cycles that have any ledger activity; null without history. */
  average: Record<string, number | null>
  /** Cycles in a row, counting back from the one before the selected cycle, that ended over the line's cap. */
  monthsOverCap: Record<string, number>
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function lineHistory(i: LineHistoryInput): LineHistory {
  const cycles = Array.from({ length: HISTORY_CYCLES }, (_, n) => {
    const key = shiftMonth(i.monthKey, -(n + 1))
    const spending = calculateCategorySpending(filterExpensesByMonth(i.expenses, key, i.monthStartDay), i.base, i.rates)
    return {
      active: Object.keys(spending).length > 0,
      byLine: spendByLine({ plan: i.plan, spendingByEnum: spending, debtPaid: i.debtPaidForMonth(key) }).byLine,
    }
  })
  const recent = cycles.slice(0, AVERAGE_CYCLES)
  const activeRecent = recent.filter((c) => c.active).length

  const average: Record<string, number | null> = {}
  const monthsOverCap: Record<string, number> = {}
  for (const l of i.plan.categories) {
    const cap = effectivePlanCategoryAmountInBase(l, i.base, i.rates)
    const total = recent.reduce((s, c) => s + (c.byLine[l.id] ?? 0), 0)
    average[l.id] = activeRecent > 0 && total > 0 ? total / activeRecent : null
    let over = 0
    while (over < cycles.length && cap > 0 && (cycles[over].byLine[l.id] ?? 0) > cap) over++
    monthsOverCap[l.id] = over
  }
  return { average, monthsOverCap }
}
