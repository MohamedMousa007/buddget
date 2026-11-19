import type { SubscriptionView } from './subscriptionView'

/** A trial this close to its end swaps the chevron for "Keep Pro". */
export const TRIAL_ENDING_DAYS = 3

export type ProRowState = 'free' | 'trial' | 'trialEnding' | 'active' | 'canceled' | 'issue' | 'ended'

const DAY = 86_400_000

/** Whole days left in a trial (rounded up, never negative). */
export function trialDaysLeft(until: string | null, now = Date.now()): number {
  const end = until ? Date.parse(until) : NaN
  return Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / DAY)) : 0
}

/** The state the Pro row draws, from the plan the server reported. Pure: the clock is passed in. */
export function proRowState(view: SubscriptionView, now = Date.now()): ProRowState {
  switch (view.kind) {
    case 'free': return 'free'
    case 'expired': return 'ended'
    case 'issue': return 'issue'
    case 'canceled': return 'canceled'
    case 'active': return 'active'
    case 'trial': return trialDaysLeft(view.until, now) <= TRIAL_ENDING_DAYS ? 'trialEnding' : 'trial'
  }
}

/** The profile menu offers Pro only when there is something to do about it. */
export const menuShowsProRow = (state: ProRowState): boolean => state === 'free' || state === 'trial' || state === 'trialEnding' || state === 'issue'
