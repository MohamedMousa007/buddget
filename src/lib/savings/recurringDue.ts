import { addMonths, format, parseISO } from 'date-fns'
import { deterministicId } from '@/lib/savings/accountLeg'

/** The newest unposted due date up to `today` (missed months collapse into one catch-up deposit) and the date after it. */
export function dueDatesThrough(nextDueDate: string, today: string): { due: string; next: string } {
  let cur = parseISO(nextDueDate.includes('T') ? nextDueDate : `${nextDueDate}T12:00:00`)
  let due = format(cur, 'yyyy-MM-dd')
  let next = due
  while (next <= today) {
    due = next
    cur = addMonths(cur, 1)
    next = format(cur, 'yyyy-MM-dd')
  }
  return { due, next }
}

export const recurringTxId = (recurringId: string, dueDate: string) => deterministicId(`recurring:${recurringId}:${dueDate}`)
