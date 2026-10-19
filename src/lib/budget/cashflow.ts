import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, startOfDay, startOfMonth } from 'date-fns'
import type { BudgetBlock } from '@/lib/store/types'

export type CashEventKind = 'income' | 'bill' | 'subscription' | 'debt' | 'transfer' | 'everyday'

export interface CycleLine {
  name: string
  block: BudgetBlock
  amount: number
  dueDay: number | null
  essential: boolean
  /** Moves on payday by itself (standing order or automatic transfer). */
  auto: boolean
}

export interface CycleTimelineInput {
  /** The payday the cycle starts on. */
  cycleStart: Date
  cycleDays: number
  paydayDay: number
  income: number
  openingCash: number
  lines: CycleLine[]
  everydayMonthly: number
}

export interface CashEvent {
  date: Date
  label: string
  /** Negative = money out. */
  amount: number
  block: BudgetBlock | 'income'
  kind: CashEventKind
  /** Cash after this event, with everyday spending drifted down to the day before it. */
  cashAfter: number
}

export interface CashPoint {
  date: Date
  cash: number
}

export interface CycleTimeline {
  events: CashEvent[]
  /** End-of-day cash, one per day of the cycle. */
  points: CashPoint[]
  lowest: CashPoint
  dailyAllowance: number
  dipsBelowZero: boolean
  tightestDayLabel: string
}

const KIND_BY_BLOCK: Record<BudgetBlock, CashEventKind> = {
  bills: 'bill',
  subscriptions: 'subscription',
  debts: 'debt',
  everyday: 'everyday',
  safety: 'transfer',
  goals: 'transfer',
  grow: 'transfer',
}

const FIXED_BILL_BLOCKS: readonly BudgetBlock[] = ['bills', 'subscriptions', 'debts']

/** First date on or after the cycle start that lands on `day` of a month, or null when it falls past the cycle. */
function dueDate(cycleStart: Date, cycleDays: number, day: number): Date | null {
  const inMonth = (m: Date) => addDays(startOfMonth(m), Math.min(day, getDaysInMonth(m)) - 1)
  let d = inMonth(cycleStart)
  if (d < cycleStart) d = inMonth(addMonths(cycleStart, 1))
  return differenceInCalendarDays(d, cycleStart) < cycleDays ? d : null
}

function placement(line: CycleLine, input: CycleTimelineInput, start: Date): Date | null {
  if (line.auto) return start
  if (line.dueDay != null) return dueDate(start, input.cycleDays, line.dueDay)
  // Unscheduled fixed payments are assumed due on the 1st.
  if (FIXED_BILL_BLOCKS.includes(line.block)) return dueDate(start, input.cycleDays, 1)
  return start
}

export function buildCycleTimeline(input: CycleTimelineInput): CycleTimeline {
  const start = startOfDay(input.cycleStart)
  const dailyAllowance = input.everydayMonthly / input.cycleDays

  const raw: Array<Omit<CashEvent, 'cashAfter'>> = [
    { date: start, label: 'income', amount: input.income, block: 'income', kind: 'income' },
  ]
  for (const line of input.lines) {
    if (line.block === 'everyday') continue
    const date = placement(line, input, start)
    if (date) raw.push({ date, label: line.name, amount: -line.amount, block: line.block, kind: KIND_BY_BLOCK[line.block] })
  }

  // Stable sort: income leads its day, then lines keep input order.
  const sorted = raw
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.getTime() - b.e.date.getTime() || a.i - b.i)
    .map(({ e }) => e)

  let cash = input.openingCash
  const events = sorted.map((e): CashEvent => {
    cash += e.amount
    const elapsed = differenceInCalendarDays(e.date, start)
    return { ...e, cashAfter: cash - dailyAllowance * elapsed }
  })

  const points: CashPoint[] = []
  let running = input.openingCash
  let next = 0
  for (let day = 0; day < input.cycleDays; day++) {
    const date = addDays(start, day)
    while (next < sorted.length && differenceInCalendarDays(sorted[next].date, start) <= day) running += sorted[next++].amount
    points.push({ date, cash: running - dailyAllowance * (day + 1) })
  }

  const lowest = points.reduce((low, p) => (p.cash < low.cash ? p : low))
  return {
    events,
    points,
    lowest,
    dailyAllowance,
    dipsBelowZero: lowest.cash < 0,
    tightestDayLabel: format(lowest.date, 'd MMM'),
  }
}
