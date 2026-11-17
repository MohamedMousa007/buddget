import 'server-only'
import type { ServiceClient } from '@/lib/supabase/service'
import { invalidatePlatformSettings } from '@/lib/server/platformCache'
import { resetBillingSwitchCache } from '@/lib/entitlements/billingSwitch'

/**
 * The admin data layer for Pro, Sparks, loyalty and invites (spec section 5): thin calls to the `admin_rewards_*` SQL functions
 * (migration 0309). Each write checks that `actorUserId` is an active staff member and writes admin_audit_log in the same
 * transaction, so callers need no separate audit write. Permission checks (billing.grant, sparks.manage, loyalty.manage,
 * referrals.manage) stay in the admin route. Results are `{ status, ... }` objects; a thrown database error comes back as
 * `{ status: 'error', message }`.
 */
export type AdminResult = { status: string; [key: string]: unknown }
export type SwitchKey = 'billing' | 'tiers' | 'referrals' | 'spark_gifts'

async function call(service: ServiceClient, fn: string, args: Record<string, unknown>): Promise<AdminResult> {
  const { data, error } = await (service.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args)
  if (error) return { status: 'error', message: error.message }
  return (data ?? { status: 'error' }) as AdminResult
}

export const rewardsAdmin = (service: ServiceClient, actorUserId: string) => ({
  grantPro: (userId: string, endsAt: string | null, note?: string) => call(service, 'admin_rewards_pro_grant', { p_actor: actorUserId, p_user: userId, p_ends_at: endsAt, p_note: note ?? null }),
  removePro: (userId: string, note?: string) => call(service, 'admin_rewards_pro_remove', { p_actor: actorUserId, p_user: userId, p_note: note ?? null }),
  startTrial: (userId: string, days = 30) => call(service, 'admin_rewards_trial_start', { p_actor: actorUserId, p_user: userId, p_days: days }),
  endTrial: (userId: string) => call(service, 'admin_rewards_trial_end', { p_actor: actorUserId, p_user: userId }),
  bankProDays: (userId: string, days: number) => call(service, 'admin_rewards_bank_pro_days', { p_actor: actorUserId, p_user: userId, p_days: days }),
  adjustSparks: (userId: string, amount: number, bucket: 'reward' | 'purchased', reason: string) =>
    call(service, 'admin_rewards_sparks_adjust', { p_actor: actorUserId, p_user: userId, p_amount: amount, p_bucket: bucket, p_reason: reason }),
  sparksLedger: (userId: string, limit = 50) => call(service, 'admin_rewards_sparks_ledger', { p_user: userId, p_limit: limit }),
  setTier: (userId: string, tier: string | null, locked: boolean) => call(service, 'admin_rewards_set_tier', { p_actor: actorUserId, p_user: userId, p_tier: tier, p_locked: locked }),
  addFreezes: (userId: string, count: number) => call(service, 'admin_rewards_add_freezes', { p_actor: actorUserId, p_user: userId, p_count: count }),
  setStreak: (userId: string, weeks: number, step: 0 | 1 | 2 | null = null, lastKeptWeek: string | null = null) =>
    call(service, 'admin_rewards_set_streak', { p_actor: actorUserId, p_user: userId, p_weeks: weeks, p_step: step, p_last_kept_week: lastKeptWeek }),
  setFounder: (userId: string, number: number | null = null) => call(service, 'admin_rewards_founder_set', { p_actor: actorUserId, p_user: userId, p_number: number }),
  removeFounder: (userId: string) => call(service, 'admin_rewards_founder_remove', { p_actor: actorUserId, p_user: userId }),
  resetLoyalty: (userId: string) => call(service, 'admin_rewards_loyalty_reset', { p_actor: actorUserId, p_user: userId }),
  referralsFor: (userId: string) => call(service, 'admin_rewards_referrals_for', { p_user: userId }),
  approveReferral: (referralId: number) => call(service, 'admin_rewards_referral_approve', { p_actor: actorUserId, p_referral: referralId }),
  revokeReferral: (referralId: number) => call(service, 'admin_rewards_referral_revoke', { p_actor: actorUserId, p_referral: referralId }),
  markReferralActivated: (referralId: number) => call(service, 'admin_rewards_referral_mark_activated', { p_actor: actorUserId, p_referral: referralId }),
  /** Flips a platform switch and drops the server-side settings caches so every instance sees it. */
  setSwitch: async (key: SwitchKey, enabled: boolean) => {
    const result = await call(service, 'admin_rewards_platform_switch', { p_actor: actorUserId, p_key: key, p_enabled: enabled })
    if (result.status === 'ok') {
      invalidatePlatformSettings()
      if (key === 'billing') resetBillingSwitchCache()
    }
    return result
  },
})
