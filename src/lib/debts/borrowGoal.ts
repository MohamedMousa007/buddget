import { addMonths, differenceInCalendarMonths, format, parseISO } from 'date-fns'
import type { DebtGoal } from '@/lib/store/types'

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
