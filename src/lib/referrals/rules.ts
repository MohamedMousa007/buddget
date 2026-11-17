/**
 * Invite-a-friend rules, mirrored from migration 0308 (referral_evaluate, referral_reward, referral_clawback) so the Invite page can
 * show progress and the tests pin the rules. The database decides; this module never writes.
 */

export const ACTIVATION_DAYS = 3
export const ACTIVATION_RECORDS = 5
export const ACTIVATION_WINDOW_DAYS = 14
export const MONTH_CAP = 4
export const YEAR_CAP = 12
export const CLAWBACK_WINDOW_DAYS = 30
export const FRIEND_TRIAL_DAYS = 37
export const INVITER_PRO_DAYS = 7
export const STORE_SUBSCRIBER_SPARKS = 500
const DAY = 86_400_000

export type ReferralStatus = 'pending' | 'activated' | 'rewarded' | 'capped' | 'rejected' | 'expired' | 'revoked' | 'clawed_back'

/** Activated = active on 3 separate days and 5 records logged, both inside the friend's first 14 days. */
export const isActivated = (activeDays: number, records: number): boolean => activeDays >= ACTIVATION_DAYS && records >= ACTIVATION_RECORDS

/** The status the nightly check gives a pending friend. */
export function evaluatePending(activeDays: number, records: number, signedUpAt: Date, now: Date): 'activated' | 'expired' | 'pending' {
  if (isActivated(activeDays, records)) return 'activated'
  return now.getTime() >= signedUpAt.getTime() + ACTIVATION_WINDOW_DAYS * DAY ? 'expired' : 'pending'
}

/** Whether one more reward fits: at most 4 per calendar month and 12 per calendar year (UTC). */
export function capCheck(rewardedThisMonth: number, rewardedThisYear: number): 'ok' | 'month_cap' | 'year_cap' {
  if (rewardedThisYear >= YEAR_CAP) return 'year_cap'
  if (rewardedThisMonth >= MONTH_CAP) return 'month_cap'
  return 'ok'
}

export type Milestone = { kind: 'points'; amount: number } | { kind: 'card_finish'; item: 'connector' }

/** What reaching this many activated friends unlocks (paid once, at exactly 3, 5 and 10). */
export function milestoneAt(activatedFriends: number): Milestone | null {
  if (activatedFriends === 3) return { kind: 'points', amount: 50 }
  if (activatedFriends === 5) return { kind: 'points', amount: 100 }
  if (activatedFriends === 10) return { kind: 'card_finish', item: 'connector' }
  return null
}

/** A paying store subscriber gets 500 reward Sparks; everyone else 1 banked week of Pro. */
export const rewardKind = (payingStoreSubscriber: boolean): 'sparks' | 'pro_week' => (payingStoreSubscriber ? 'sparks' : 'pro_week')

/** A paid reward is taken back when the friend's account is deleted within 30 days of sign-up. */
export const clawbackDue = (status: ReferralStatus, signedUpAt: Date, deletedAt: Date): boolean =>
  status === 'rewarded' && deletedAt.getTime() < signedUpAt.getTime() + CLAWBACK_WINDOW_DAYS * DAY

/** "Active 2 of 3 days" progress for a pending friend, each part capped at its goal. */
export const progress = (activeDays: number, records: number) => ({
  days: Math.min(activeDays, ACTIVATION_DAYS), daysNeeded: ACTIVATION_DAYS,
  records: Math.min(records, ACTIVATION_RECORDS), recordsNeeded: ACTIVATION_RECORDS,
})
