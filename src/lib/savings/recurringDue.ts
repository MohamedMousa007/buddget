import { addMonths, format, getDaysInMonth, parseISO, startOfMonth } from 'date-fns'
import { deterministicId } from '@/lib/savings/accountLeg'

/** The same calendar day next month, clamped to the month's length without losing the anchor (Jan 31 -> Feb 28 -> Mar 31). */
function nextMonth(cur: Date, anchorDay: number): Date {
  const first = addMonths(startOfMonth(cur), 1)
  first.setDate(Math.min(anchorDay, getDaysInMonth(first)))
  return first
}

/** The newest unposted due date up to `today` (missed months collapse into one catch-up deposit) and the date after it. Month-end dates keep their original day (Jan 31 -> Feb 28 -> Mar 31). */
export function dueDatesThrough(nextDueDate: string, today: string, anchor?: number): { due: string; next: string } {
  let cur = parseISO(nextDueDate.includes('T') ? nextDueDate : `${nextDueDate}T12:00:00`)
  const anchorDay = anchor && anchor > cur.getDate() ? Math.min(31, anchor) : cur.getDate()
  let due = format(cur, 'yyyy-MM-dd')
  let next = due
  while (next <= today) {
    due = next
    cur = nextMonth(cur, anchorDay)
    next = format(cur, 'yyyy-MM-dd')
  }
  return { due, next }
}

export const recurringTxId = (recurringId: string, dueDate: string) => deterministicId(`recurring:${recurringId}:${dueDate}`)

/** Most missed months posted when a device comes back after a long gap; older ones are not back-filled. */
export const MAX_BACKFILL_DEPOSITS = 3

/** Every unposted due date up to `today` (newest `MAX_BACKFILL_DEPOSITS`), oldest first, and the date after the last. */
export function backfillDueDates(nextDueDate: string, today: string, anchor?: number): { dues: string[]; next: string } {
  const dues: string[] = []
  let cur = nextDueDate
  let next = nextDueDate
  while (next <= today) {
    const step = dueDatesThrough(cur, cur, anchor)
    dues.push(step.due)
    cur = next = step.next
  }
  return { dues: dues.slice(-MAX_BACKFILL_DEPOSITS), next }
}
