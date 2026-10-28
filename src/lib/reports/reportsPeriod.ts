import { addMonths, parseISO, subMonths } from 'date-fns'
import { budgetMonthKeyFor, getMonthRange } from '@/lib/utils/calculations'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import type { Expense } from '@/lib/store/types'

export type ReportRangePreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear'

const CYCLES_BACK: Record<Exclude<ReportRangePreset, 'thisYear'>, { back: number; count: number }> = {
  thisMonth: { back: 0, count: 1 },
  lastMonth: { back: 1, count: 1 },
  last3Months: { back: 2, count: 3 },
  last6Months: { back: 5, count: 6 },
}

/** Budget-cycle keys (`YYYY-MM`) a report preset covers, oldest first. Cycles follow `monthStartDay`. */
export function reportCycles(preset: ReportRangePreset, now: Date, monthStartDay: number): string[] {
  const current = parseISO(`${budgetMonthKeyFor(now, monthStartDay)}-01`)
  let back: number
  let count: number
  if (preset === 'thisYear') {
    back = current.getMonth()
    count = back + 1
  } else {
    ;({ back, count } = CYCLES_BACK[preset])
  }
  const first = subMonths(current, back)
  return Array.from({ length: count }, (_, i) => {
    const d = addMonths(first, i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export function reportRange(preset: ReportRangePreset, now: Date, monthStartDay: number): { start: Date; end: Date } {
  const keys = reportCycles(preset, now, monthStartDay)
  return {
    start: getMonthRange(keys[0], monthStartDay).start,
    end: getMonthRange(keys[keys.length - 1], monthStartDay).end,
  }
}

/** Rows that count as spending, same rule as the Flow hero: no transfers, ATM, card payoff, top-up, savings or excluded rows. */
export function reportSpendRows(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => !isNonSpendExpense(e))
}
