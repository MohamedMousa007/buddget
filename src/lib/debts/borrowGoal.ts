import { addMonths, differenceInCalendarMonths, format, parseISO } from 'date-fns'
import type { Debt, DebtGoal } from '@/lib/store/types'
import { addCalendarWeeks, weeksElapsed } from '@/lib/time/calendarDays'

export type GoalFrequency = DebtGoal['paymentFrequency']
export type GoalUnit = 'months' | 'years'

const WEEKS_PER_MONTH = 4.345
const MONTHS_PER_PERIOD = { monthly: 1, quarterly: 3, annually: 12 } as const

export function goalMonths(duration: number, unit: GoalUnit): number {
  return Math.max(1, Math.round(unit === 'years' ? duration * 12 : duration))
}

/** Number of equal payments over the chosen span (at least one). */
export function goalPaymentCount(duration: number, unit: GoalUnit, frequency: GoalFrequency): number {
  const months = goalMonths(duration, unit)
  if (frequency === 'weekly') return Math.max(1, Math.round(months * WEEKS_PER_MONTH))
  return Math.max(1, Math.floor(months / MONTHS_PER_PERIOD[frequency]))
}

/** Fixed per-payment amount — total ÷ payments, never interest. */
export function goalAmountPerPayment(total: number, duration: number, unit: GoalUnit, frequency: GoalFrequency): number {
  return Math.round((total / goalPaymentCount(duration, unit, frequency)) * 100) / 100
}

export function goalTargetDate(duration: number, unit: GoalUnit, from: Date = new Date()): string {
  return format(addMonths(from, goalMonths(duration, unit)), 'yyyy-MM-dd')
}

/** Recover an editable duration from a stored target date (whole years surface as years). */
export function goalDurationFromTarget(targetDate: string, from: Date = new Date()): { duration: number; unit: GoalUnit } {
  const months = Math.max(1, differenceInCalendarMonths(parseISO(targetDate), from))
  return months % 12 === 0 ? { duration: months / 12, unit: 'years' } : { duration: months, unit: 'months' }
}

/** The day a borrow's pay-off schedule counts from: the borrow date the user picked, else the day it was added. */
export function borrowScheduleStart(debt: Pick<Debt, 'startDate' | 'createdAt'>): Date {
  return parseISO((debt.startDate || debt.createdAt).slice(0, 10))
}

/** Payments the schedule expects by `now`, and the next payment's day: one period after the borrow date, then on. */
export function borrowGoalSchedule(start: Date, frequency: GoalFrequency, now: Date = new Date()): { elapsed: number; next: Date } {
  if (frequency === 'weekly') {
    const elapsed = Math.max(0, weeksElapsed(now, start))
    return { elapsed, next: addCalendarWeeks(start, elapsed + 1) }
  }
  const per = MONTHS_PER_PERIOD[frequency]
  const elapsed = Math.floor(Math.max(0, differenceInCalendarMonths(now, start)) / per)
  return { elapsed, next: addMonths(start, (elapsed + 1) * per) }
}
