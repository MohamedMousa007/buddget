import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { reportSpendRows } from '@/lib/reports/reportsPeriod'
import { actualIncomeForMonth, budgetMonthKeyFor, expenseAmountInBase, filterExpensesByRange, getMonthRange, isExpenseUnconverted } from '@/lib/utils/calculations'
import type { InsightSource } from './buildInput'

export interface Recap {
  /** The closed cycle the recap is about (`YYYY-MM`). */
  cycle: string
  purchases: number
  /** Length of the cycle in days. */
  days: number
  spent: number
  /** The cycle before it; null without data. */
  spentBefore: number | null
  received: number
  topCategory: { name: string; amount: number } | null
  biggest: { description: string; amount: number; date: string } | null
}

export const MIN_RECAP_PURCHASES = 8

const keyBack = (first: Date, back: number) => {
  const d = addMonths(first, -back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The last closed cycle in numbers. Null while it has too few purchases to be worth telling. */
export function buildRecap(src: InsightSource, now: Date): Recap | null {
  const { settings, exchangeRates: rates } = src
  const base = settings.baseCurrency
  const startDay = settings.monthStartDay
  const first = parseISO(`${budgetMonthKeyFor(now, startDay)}-01`)
  const cycle = keyBack(first, 1)
  const rowsOf = (key: string) => reportSpendRows(filterExpensesByRange(src.expenses, getMonthRange(key, startDay)))
  const window = getMonthRange(cycle, startDay)
  const rows = rowsOf(cycle)
  if (rows.length < MIN_RECAP_PURCHASES) return null
  const sum = (list: typeof rows) => list.reduce((s, e) => s + expenseAmountInBase(e, base, rates), 0)
  const before = rowsOf(keyBack(first, 2))
  const byCategory = new Map<string, number>()
  let biggest: Recap['biggest'] = null
  for (const e of rows) {
    if (e.isDebtPayment || isExpenseUnconverted(e, base, rates)) continue
    const a = expenseAmountInBase(e, base, rates)
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + a)
    if (!e.refundedAt && (!biggest || a > biggest.amount)) biggest = { description: e.description, amount: a, date: e.date }
  }
  let topCategory: Recap['topCategory'] = null
  for (const [name, amount] of byCategory) if (!topCategory || amount > topCategory.amount) topCategory = { name, amount }
  return {
    cycle,
    purchases: rows.length,
    days: differenceInCalendarDays(window.end, window.start) + 1,
    spent: sum(rows),
    spentBefore: before.length >= MIN_RECAP_PURCHASES ? sum(before) : null,
    received: actualIncomeForMonth(src.incomeSources, src.incomeEvents, base, rates, cycle, startDay, true),
    topCategory,
    biggest,
  }
}
