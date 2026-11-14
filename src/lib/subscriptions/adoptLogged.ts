import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Expense } from '@/lib/store/types'

/** An SMS charge this close to a charge the app wrote itself is the same payment. */
export const ADOPT_WINDOW_DAYS = 5

/**
 * Ids of app-written charges that an incoming SMS-linked charge replaces. The app writes a
 * subscription's charge itself in `log` mode or on "Mark paid" (an expense flagged recurring,
 * with no SMS behind it); when the real SMS arrives it must replace that row, not sit beside
 * it, or the same payment would count twice in Flow and the budget.
 */
export function loggedChargesAdopted(
  expenses: Pick<Expense, 'id' | 'linkedSubscriptionId' | 'isRecurring' | 'smsLogId' | 'date'>[],
  incoming: Pick<Expense, 'id' | 'linkedSubscriptionId' | 'smsLogId' | 'date'>
): string[] {
  if (!incoming.linkedSubscriptionId || !incoming.smsLogId) return []
  return expenses
    .filter(
      (e) =>
        e.id !== incoming.id &&
        e.linkedSubscriptionId === incoming.linkedSubscriptionId &&
        e.isRecurring &&
        !e.smsLogId &&
        Math.abs(differenceInCalendarDays(parseISO(e.date.slice(0, 10)), parseISO(incoming.date.slice(0, 10)))) <= ADOPT_WINDOW_DAYS
    )
    .map((e) => e.id)
}

/**
 * `merged` without the app-written charges that an SMS-linked row among `incoming` replaces. The removal is a plain
 * local delete, so the sync diff against the delivered snapshot tombstones the dropped rows on the server.
 */
export function withoutAdoptedLogged<T extends Pick<Expense, 'id' | 'linkedSubscriptionId' | 'isRecurring' | 'smsLogId' | 'date'>>(
  merged: T[],
  incoming: readonly Pick<Expense, 'id' | 'linkedSubscriptionId' | 'smsLogId' | 'date'>[]
): T[] {
  const present = new Set(merged.map((e) => e.id))
  const adopted = new Set<string>()
  for (const row of incoming) {
    if (present.has(row.id)) for (const id of loggedChargesAdopted(merged, row)) adopted.add(id)
  }
  return adopted.size > 0 ? merged.filter((e) => !adopted.has(e.id)) : merged
}
