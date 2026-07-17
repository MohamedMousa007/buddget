import { addWeeks, isWithinInterval, parseISO, startOfDay, subMilliseconds } from 'date-fns'
import type { Expense, Subscription } from '@/lib/store/types'
import { advanceCycle, firstBillingOnOrAfter } from './subscriptionDates'

export interface CycleWindow {
  /** The charge date that opened the current cycle. */
  start: Date
  /** The next charge date — exclusive; a charge on this day belongs to the NEXT cycle. */
  end: Date
}

/**
 * The billing cycle `ref` falls inside: [this cycle's charge date, the next one).
 *
 * No new state is needed for this. `nextBillingDate` is already a pure function of
 * startDate + billingDay + cycle walking forward past today, so it self-advances — unlike
 * a debt's `nextDueDate`, which is stored precisely because debt payments are irregular.
 * Subscriptions are calendar-locked, so the cycle is derivable and "advance to the next
 * cycle" is a no-op that already happens.
 */
export function cycleWindow(
  sub: Pick<Subscription, 'startDate' | 'billingDay' | 'billingCycle'>,
  ref: Date = new Date()
): CycleWindow {
  const start = startOfDay(parseISO(sub.startDate.slice(0, 10)))
  const today = startOfDay(ref)
  const billingDay = sub.billingDay || start.getDate()

  const step = (from: Date): Date =>
    sub.billingCycle === 'weekly' ? addWeeks(from, 1) : advanceCycle(from, billingDay, sub.billingCycle)

  let current = sub.billingCycle === 'weekly' ? start : firstBillingOnOrAfter(start, billingDay)
  // Before the first charge: the cycle runs from the start date up to it, and is unpaid.
  if (today < current) return { start, end: current }

  let next = step(current)
  while (next <= today) {
    current = next
    next = step(next)
  }
  return { start: current, end: next }
}

/**
 * Has THIS cycle's charge landed?
 *
 * Derived from the existing `expenses.linked_subscription_id` FK plus the expense date —
 * no occurrence table, no new column, nothing to keep in sync.
 *
 * Deliberately NOT inferred from `nextBillingDate` having moved: that date advances on its
 * own with the calendar whether or not anyone was charged, so it would mark every
 * subscription paid forever. A badge that lies about money is worse than no badge.
 */
export function isCyclePaid(
  sub: Pick<Subscription, 'id' | 'startDate' | 'billingDay' | 'billingCycle'>,
  expenses: Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind'>[],
  ref: Date = new Date()
): boolean {
  const { start, end } = cycleWindow(sub, ref)
  // A future-dated / not-yet-started sub yields end === start; subtracting 1ms would invert
  // the interval and make date-fns `isWithinInterval` throw, crashing the card. Nothing can
  // be paid before the first cycle opens.
  if (end <= start) return false
  // `end` is exclusive — a charge on the next billing date opens the next cycle.
  const interval = { start, end: subMilliseconds(end, 1) }
  return expenses.some(
    (e) =>
      e.linkedSubscriptionId === sub.id &&
      // A refunded/declined charge did not pay for anything.
      !e.refundKind &&
      isWithinInterval(startOfDay(parseISO(e.date.slice(0, 10))), interval)
  )
}
