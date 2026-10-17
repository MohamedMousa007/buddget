import { format } from 'date-fns'
import type { Subscription } from '@/lib/store/types'

/** A date on `billingDay` in the current month, or the previous one when that day has not happened yet. */
export function startDateFromBillingDay(billingDay: number, today: Date = new Date()): string {
  const day = Math.min(31, Math.max(1, billingDay))
  let y = today.getFullYear()
  let m = today.getMonth()
  if (today.getDate() < day) {
    m -= 1
    if (m < 0) {
      m = 11
      y -= 1
    }
  }
  const lastDayOfMonth = new Date(y, m + 1, 0).getDate()
  return format(new Date(y, m, Math.min(day, lastDayOfMonth)), 'yyyy-MM-dd')
}

/**
 * The start date to persist on save. The form has no start-date field, so it derives one from
 * the billing day. Re-deriving on every edit re-anchored quarterly/yearly subscriptions to the
 * current month (their real renewal month is unknowable here), so an edit that leaves the
 * billing day alone keeps the date the subscription already has.
 */
export function startDateForSave(
  editing: Pick<Subscription, 'startDate' | 'billingDay'> | null,
  billingDay: number,
  today: Date = new Date()
): string {
  const day = Math.min(31, Math.max(1, billingDay))
  if (editing?.startDate && editing.billingDay === day) return editing.startDate
  return startDateFromBillingDay(day, today)
}
