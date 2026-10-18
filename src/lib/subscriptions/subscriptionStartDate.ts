import { format } from 'date-fns'

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
