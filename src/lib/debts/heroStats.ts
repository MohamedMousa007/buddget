import { addCalendarMonths, addCalendarWeeks, addCalendarYears } from '@/lib/time/calendarDays'
import type { DebtRecurringFrequency } from '@/lib/store/types'

type Cadence = DebtRecurringFrequency

function addCycles(start: Date, cadence: Cadence, cycles: number): Date {
  switch (cadence) {
    case 'weekly':
      return addCalendarWeeks(start, cycles)
    case 'biweekly':
      return addCalendarWeeks(start, cycles * 2)
    case 'quarterly':
      return addCalendarMonths(start, cycles * 3)
    case 'annually':
      return addCalendarYears(start, cycles)
    default:
      return addCalendarMonths(start, cycles)
  }
}

/** Date the last of `remainingPayments` lands when the next one is on `next`. Null when nothing is left. */
export function lastPaymentDate(next: Date, cadence: Cadence, remainingPayments: number): Date | null {
  if (remainingPayments <= 0) return null
  return addCycles(next, cadence, remainingPayments - 1)
}

/** Payments still needed to clear `remaining` at `perPayment` each. */
export function paymentsToClear(remaining: number, perPayment: number): number {
  return perPayment > 0 && remaining > 0 ? Math.ceil(remaining / perPayment) : 0
}

export interface DebtFreeBy {
  /** Latest projected end date across planned debts. */
  date: Date | null
  /** Active non-card debts with no schedule or goal. */
  unplanned: number
}

/** `ends` holds one entry per active non-card debt: its projected last payment, or null when unplanned. */
export function debtFreeBy(ends: (Date | null)[]): DebtFreeBy {
  let date: Date | null = null
  let unplanned = 0
  for (const e of ends) {
    if (!e) unplanned += 1
    else if (!date || e > date) date = e
  }
  return { date, unplanned }
}

export interface MonthProgress {
  paid: number
  /** paid + still due this month. */
  total: number
  /** 0-100. */
  pct: number
}

export function monthProgress(paid: number, stillDue: number): MonthProgress {
  const total = paid + Math.max(0, stillDue)
  return { paid, total, pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0 }
}
