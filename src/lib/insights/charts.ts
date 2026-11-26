import { addDays, addMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { reportSpendRows } from '@/lib/reports/reportsPeriod'
import { actualIncomeForMonth, budgetMonthKeyFor, expenseAmountInBase, filterExpensesByRange, getMonthRange, isExpenseUnconverted } from '@/lib/utils/calculations'
import { totalDaysInMonth } from '@/lib/utils/spendingPace'
import type { InsightSource } from './buildInput'

/** The numbers the Insights charts draw, reduced from the store once per change. Base currency throughout. */
export interface InsightCharts {
  /** Counted spend on each day of the running cycle so far (index 0 = its first day). */
  daily: number[]
  /** This cycle's categories against the same number of days at the start of the last cycle, biggest first. */
  categories: { name: string; amount: number; last: number }[]
  /** The last 12 cycles, oldest first; the running cycle is last and still partial. */
  months: { key: string; spent: number; received: number }[]
}

export const CHART_MONTHS = 12

const keyBack = (first: Date, back: number) => {
  const d = addMonths(first, -back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Same counting rule as the hero and Reports (`isReportSpendRow`); category views leave out debt repayments and unconverted rows. */
export function buildInsightCharts(src: InsightSource, now: Date): InsightCharts {
  const { settings, exchangeRates: rates } = src
  const base = settings.baseCurrency
  const startDay = settings.monthStartDay
  const key = budgetMonthKeyFor(now, startDay)
  const first = parseISO(`${key}-01`)
  const range = getMonthRange(key, startDay)
  // From `now`, not the device clock, so the function stays pure.
  const elapsed = Math.min(Math.max(differenceInCalendarDays(now, range.start) + 1, 1), totalDaysInMonth(key, startDay))
  const amount = (e: InsightSource['expenses'][number]) => expenseAmountInBase(e, base, rates)
  const rowsIn = (r: { start: Date; end: Date }) => reportSpendRows(filterExpensesByRange(src.expenses, r))

  const rows = rowsIn(range)
  const daily = Array<number>(Math.max(0, elapsed)).fill(0)
  for (const e of rows) {
    const i = differenceInCalendarDays(parseISO(`${e.date.slice(0, 10)}T12:00:00`), range.start)
    if (i >= 0 && i < daily.length) daily[i] += amount(e)
  }

  const habit = (list: typeof rows) => list.filter((e) => !e.isDebtPayment && !isExpenseUnconverted(e, base, rates))
  const lastRange = getMonthRange(keyBack(first, 1), startDay)
  const lastWindowEnd = addDays(lastRange.start, Math.max(0, elapsed - 1))
  const lastRows = habit(rowsIn({ start: lastRange.start, end: lastWindowEnd < lastRange.end ? lastWindowEnd : lastRange.end }))
  const byName = new Map<string, { amount: number; last: number }>()
  for (const e of habit(rows)) {
    const c = byName.get(e.category) ?? { amount: 0, last: 0 }
    c.amount += amount(e)
    byName.set(e.category, c)
  }
  for (const e of lastRows) {
    const c = byName.get(e.category)
    if (c) c.last += amount(e)
  }
  const categories = [...byName].map(([name, c]) => ({ name, ...c })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount)

  const months = Array.from({ length: CHART_MONTHS }, (_, i) => {
    const k = keyBack(first, CHART_MONTHS - 1 - i)
    const spent = rowsIn(getMonthRange(k, startDay)).reduce((s, e) => s + amount(e), 0)
    return { key: k, spent, received: actualIncomeForMonth(src.incomeSources, src.incomeEvents, base, rates, k, startDay, true) }
  })

  return { daily, categories, months }
}

/** Running total from day 0 (always 0) to the end of the last day given. */
export function cumulative(daily: readonly number[]): number[] {
  const out = [0]
  for (const v of daily) out.push(out[out.length - 1] + v)
  return out
}

export const OTHER_SLICE = '__other'
/** Distinct colours the donut can give; the rest fold into one neutral "Other" slice so no colour repeats. */
export const MAX_SLICES = 6

export interface CategorySlice {
  name: string
  amount: number
  /** Whole percent of the total. */
  share: number
  /** Whole percent against the same days of the last cycle; null when there was nothing to compare with. */
  delta: number | null
}

const deltaPct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null)

/** The donut's slices: the biggest categories each keep a colour, the long tail is one "Other" slice. */
export function categorySlices(cats: readonly { name: string; amount: number; last: number }[]): CategorySlice[] {
  const total = cats.reduce((s, c) => s + c.amount, 0)
  if (total <= 0) return []
  const head = cats.length <= MAX_SLICES ? cats : cats.slice(0, MAX_SLICES - 1)
  const tail = cats.length <= MAX_SLICES ? [] : cats.slice(MAX_SLICES - 1)
  const rows = tail.length
    ? [...head, { name: OTHER_SLICE, amount: tail.reduce((s, c) => s + c.amount, 0), last: tail.reduce((s, c) => s + c.last, 0) }]
    : [...head]
  return rows.map((c) => ({ name: c.name, amount: c.amount, share: Math.round((c.amount / total) * 100), delta: deltaPct(c.amount, c.last) }))
}

export type MonthsStory =
  | { kind: 'overThenUnder'; index: number; by: number }
  | { kind: 'lastOver'; index: number; by: number }
  | { kind: 'allUnder'; count: number }

/**
 * One sentence about the closed cycles against today's budget: the last one that went over and whether it has
 * held since. `keptPct` is the mean share of income kept over closed cycles that had income. Null with no budget.
 */
export function monthsStory(months: readonly { spent: number; received: number }[], budget: number): { story: MonthsStory | null; keptPct: number | null } {
  const closed = months.slice(0, -1).map((m, index) => ({ ...m, index })).filter((m) => m.spent > 0)
  const withIncome = closed.filter((m) => m.received > 0)
  const keptPct = withIncome.length ? Math.round((withIncome.reduce((s, m) => s + (m.received - m.spent) / m.received, 0) / withIncome.length) * 100) : null
  if (budget <= 0 || closed.length === 0) return { story: null, keptPct }
  const over = closed.filter((m) => m.spent > budget)
  if (over.length === 0) return { story: { kind: 'allUnder', count: closed.length }, keptPct }
  const last = over[over.length - 1]
  const by = Math.round(last.spent - budget)
  return { story: last === closed[closed.length - 1] ? { kind: 'lastOver', index: last.index, by } : { kind: 'overThenUnder', index: last.index, by }, keptPct }
}
