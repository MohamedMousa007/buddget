import { createClient } from '@/lib/supabase/client'
import type { ReferralStatus } from './rules'

export interface ReferralFriend {
  id: number
  /** First word of the friend's own display name, or null. */
  name: string | null
  joined_at: string
  status: ReferralStatus
  active_days: number
  active_days_needed: 3
  transactions: number
  transactions_needed: 5
  window_ends_at: string
  reward_kind: 'pro_week' | 'sparks' | null
}

export interface ReferralSummary {
  enabled: boolean
  code: string
  link: string
  counts: { invited: number; activated: number; rewarded: number }
  caps: { month: 4; year: 12; monthUsed: number; yearUsed: number }
  rewards: { proDaysEarned: number; proDaysBanked: number; sparksEarned: number }
  milestones: Array<{ friends: 3 | 5 | 10; kind: 'points' | 'card_finish'; amount?: number; item?: 'connector'; reached: boolean }>
  /** Up to 50, newest first. */
  friends: ReferralFriend[]
}

export type RedeemStatus = 'ok' | 'disabled' | 'invalid_code' | 'self_invite' | 'account_too_old' | 'already_redeemed' | 'device_used' | 'error'

/** The Invite page in one call. Null on any failure. */
export async function fetchReferralSummary(): Promise<ReferralSummary | null> {
  const { data, error } = await createClient().rpc('referral_my_summary')
  return error || !data ? null : (data as unknown as ReferralSummary)
}

/**
 * Redeems an invite code for the signed-in new account (call right after sign-up). `deviceId` is the native device id when there is
 * one. `trialExtended` is true when a running trial got its 7 extra days now; otherwise the trial claim adds them.
 */
export async function redeemInviteCode(code: string, deviceId?: string | null): Promise<{ status: RedeemStatus; trialExtended?: boolean }> {
  const { data, error } = await createClient().rpc('referral_redeem', { p_code: code, p_device_id: deviceId ?? undefined })
  if (error || !data) return { status: 'error' }
  return data as unknown as { status: RedeemStatus; trialExtended?: boolean }
}
