import type { SubscriptionTracking } from '@/lib/store/types'
import type { CycleState } from './subscriptionForecast'

export type TrackingAction = 'none' | 'ask' | 'log'

/**
 * What the app must do about a due, unrecorded charge for a given tracking mode.
 * `sms` waits for the matching message (the SMS pipeline links it); `ask` raises a one-tap
 * Paid / Not yet prompt; `log` writes the expense itself. Nothing is due while upcoming.
 */
export function trackingAction(tracking: SubscriptionTracking | undefined, cycle: CycleState): TrackingAction {
  if (cycle.kind === 'upcoming') return 'none'
  if (tracking === 'log') return 'log'
  if (tracking === 'ask') return 'ask'
  return 'none'
}
