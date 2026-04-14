import { addMonths, addWeeks, addYears, format, getDaysInMonth, parseISO, startOfDay } from 'date-fns'
import type { SubscriptionBillingCycle } from '@/lib/store/types'

function clampDay(year: number, monthIndex: number, day: number): number {
  const dim = getDaysInMonth(new Date(year, monthIndex))
  return Math.min(Math.max(1, day), dim)
}

function withBillingDay(base: Date, billingDay: number): Date {
  const y = base.getFullYear()
  const m = base.getMonth()
  return new Date(y, m, clampDay(y, m, billingDay))
}

function firstBillingOnOrAfter(start: Date, billingDay: number): Date {
  let candidate = withBillingDay(start, billingDay)
  if (candidate < startOfDay(start)) {
    candidate = withBillingDay(addMonths(start, 1), billingDay)
  }
  return candidate
}

function advanceCycle(from: Date, billingDay: number, cycle: SubscriptionBillingCycle): Date {
  switch (cycle) {
    case 'weekly':
      return addWeeks(from, 1)
    case 'monthly':
      return withBillingDay(addMonths(from, 1), billingDay)
    case 'quarterly':
      return withBillingDay(addMonths(from, 3), billingDay)
    case 'yearly':
      return withBillingDay(addYears(from, 1), billingDay)
    default:
      return withBillingDay(addMonths(from, 1), billingDay)
  }
}

/**
 * Next charge date on or after today, based on start date, billing day, and cycle.
 */
export function computeNextBillingDate(
  startDateIso: string,
  billingDay: number,
  cycle: SubscriptionBillingCycle,
  ref: Date = new Date()
): string | null {
  const start = startOfDay(parseISO(startDateIso.slice(0, 10)))
  const today = startOfDay(ref)

  if (cycle === 'weekly') {
    let d = start
    while (d < today) {
      d = addWeeks(d, 1)
    }
    return format(d, 'yyyy-MM-dd')
  }

  let next = firstBillingOnOrAfter(start, billingDay)
  while (next < today) {
    next = advanceCycle(next, billingDay, cycle)
  }
  return format(next, 'yyyy-MM-dd')
}
