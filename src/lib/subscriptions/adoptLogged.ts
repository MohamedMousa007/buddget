import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Expense } from '@/lib/store/types'

/** An SMS charge this close to a charge the app wrote itself is the same payment. */
export const ADOPT_WINDOW_DAYS = 5

/**
 * Id of the one app-written charge that an incoming SMS-linked charge replaces (the nearest in date). The app writes a
 * subscription's charge itself in `log` mode or on "Mark paid" (an expense flagged recurring, with no SMS behind it); when
 * the real SMS arrives it must replace that row, not sit beside it, or the same payment would count twice. One bank
 * message adopts at most one logged row.
 * ponytail: the 5-day window can misfire for weekly subscriptions; upgrade path is to bound it by half the billing period.
 */
export function loggedChargesAdopted(
  expenses: Pick<Expense, 'id' | 'linkedSubscriptionId' | 'isRecurring' | 'smsLogId' | 'date'>[],
  incoming: Pick<Expense, 'id' | 'linkedSubscriptionId' | 'smsLogId' | 'date'>
): string[] {
  if (!incoming.linkedSubscriptionId || !incoming.smsLogId) return []
  const at = parseISO(incoming.date.slice(0, 10))
  let best: { id: string; gap: number } | null = null
  for (const e of expenses) {
    if (e.id === incoming.id || e.linkedSubscriptionId !== incoming.linkedSubscriptionId || !e.isRecurring || e.smsLogId) continue
    const gap = Math.abs(differenceInCalendarDays(parseISO(e.date.slice(0, 10)), at))
    if (gap <= ADOPT_WINDOW_DAYS && (!best || gap < best.gap)) best = { id: e.id, gap }
  }
  return best ? [best.id] : []
}

/**
 * Ids in `expenses` to delete because an SMS-linked row among `incoming` (and present in `expenses`) replaces them. The
 * caller deletes them through the store's normal delete, so the sync diff against the delivered snapshot tombstones them.
 */
export function adoptedLoggedIds(
  expenses: Pick<Expense, 'id' | 'linkedSubscriptionId' | 'isRecurring' | 'smsLogId' | 'date'>[],
  incoming: readonly Pick<Expense, 'id' | 'linkedSubscriptionId' | 'smsLogId' | 'date'>[]
): string[] {
  const present = new Set(expenses.map((e) => e.id))
  const adopted = new Set<string>()
  for (const row of incoming) {
    if (present.has(row.id)) for (const id of loggedChargesAdopted(expenses, row)) adopted.add(id)
  }
  return [...adopted]
}
