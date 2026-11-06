import { format, startOfDay } from 'date-fns'
import { deterministicId } from '@/lib/savings/accountLeg'
import { isCyclePaid } from './subscriptionOccurrence'
import { scheduledDates, trackedFrom } from './subscriptionForecast'
import type { Expense, Subscription } from '@/lib/store/types'

/** A log-mode subscription catches up at most this many missed cycles; older ones are left as history. */
export const BACKFILL_CYCLES = 3

type Billable = Pick<Subscription, 'id' | 'startDate' | 'billingDay' | 'billingCycle' | 'createdAt' | 'trialEnd'>

/** One id per subscription cycle, so two devices (or two runs) that log the same charge write the same row. */
export const subscriptionChargeId = (subscriptionId: string, dueIso: string): string =>
  deterministicId(`subscription-charge:${subscriptionId}:${dueIso}`)

/**
 * Charge dates (`yyyy-MM-dd`) a log-mode subscription still has to write: its unpaid cycles that have opened,
 * since the day it was tracked, newest {@link BACKFILL_CYCLES}. Cycles inside a free trial are skipped.
 */
export function chargesToLog(
  sub: Billable,
  expenses: Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind'>[],
  today: Date
): string[] {
  const opened = scheduledDates(sub, trackedFrom(sub), startOfDay(today)).slice(-BACKFILL_CYCLES)
  const trialEnd = sub.trialEnd?.slice(0, 10)
  return opened
    .filter((d) => !isCyclePaid(sub, expenses, d))
    .map((d) => format(d, 'yyyy-MM-dd'))
    .filter((iso) => !trialEnd || iso >= trialEnd)
}
