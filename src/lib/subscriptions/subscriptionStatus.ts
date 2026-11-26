import { startOfDay, subDays } from 'date-fns'
import type { Expense, Subscription } from '@/lib/store/types'
import { OVERDUE_GRACE_DAYS, lifecycle, scheduledDates, trackedFrom } from './subscriptionForecast'
import { isCyclePaid } from './subscriptionOccurrence'

/** The status badge a subscription shows. There is no pause: Buddgy derives every status from the charges it sees. */
export type SubscriptionDisplayStatus = 'active' | 'trial' | 'payment_due' | 'needs_renewal' | 'cancelled'

/** Missed cycles in a row before a plan "needs renewal" (likely cancelled or the card changed). */
export const RENEWAL_MISSED_CYCLES = 2

type StatusSub = Pick<
  Subscription,
  'id' | 'name' | 'status' | 'amount' | 'currency' | 'myShare' | 'trialEnd' | 'endsOn' | 'createdAt' | 'startDate' | 'billingDay' | 'billingCycle'
>
type ChargeProbe = Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind'>

/**
 * Precedence: Cancelled (incl. ended, and legacy `paused` rows, which bill nothing) > Trial > the trailing run of tracked
 * charges that are past their grace days with no linked charge: {@link RENEWAL_MISSED_CYCLES} or more is Needs renewal,
 * one is Payment due (the `cycleState` overdue case, kept through the next cycle's grace days) > Active. Cycles before
 * the subscription was added never count as missed.
 */
export function subscriptionStatus(sub: StatusSub, expenses: readonly ChargeProbe[], today: Date = new Date()): SubscriptionDisplayStatus {
  const life = lifecycle(sub, today)
  if (life === 'cancelled' || life === 'ended' || life === 'paused') return 'cancelled'
  if (life === 'trial') return 'trial'
  const charges = expenses as ChargeProbe[]
  const lastDue = subDays(startOfDay(today), OVERDUE_GRACE_DAYS)
  const from = trackedFrom(sub)
  const due = lastDue >= from ? scheduledDates(sub, from, lastDue) : []
  let missed = 0
  for (let i = due.length - 1; i >= 0 && missed < RENEWAL_MISSED_CYCLES && !isCyclePaid(sub, charges, due[i]); i--) missed++
  return missed >= RENEWAL_MISSED_CYCLES ? 'needs_renewal' : missed === 1 ? 'payment_due' : 'active'
}
