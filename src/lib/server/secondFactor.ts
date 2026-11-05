import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RouteIdentity } from '@/lib/supabase/resolveRouteUser'

export type SecondFactorMethod = 'otp' | 'trusted_device' | 'biometric' | 'enabled_here'

/** Sign-in methods that prove the person reads the account's inbox right now: the second factor, and a fresh re-authentication. */
export const INBOX_PROOF_METHODS = ['otp', 'recovery', 'magiclink', 'email/signup']
export const INBOX_PROOF_WINDOW_SECONDS = 600

/**
 * Records that this session passed the second factor, for the server-side 2FA gate (migration 0208). Best effort by
 * design: while the gate is off (or the migration is not applied yet) nothing reads the mark, so a failure only logs.
 */
export async function recordSecondFactor(admin: SupabaseClient, identity: Pick<RouteIdentity, 'id' | 'sessionId'>, method: SecondFactorMethod): Promise<boolean> {
  if (!identity.sessionId) return false
  const { error } = await admin.rpc('record_second_factor', { p_session: identity.sessionId, p_user: identity.id, p_method: method })
  if (error) {
    console.error('[second-factor] record failed', error.message)
    return false
  }
  return true
}
