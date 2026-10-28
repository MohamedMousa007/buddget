import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import type { RouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { signedInWithin } from '@/lib/auth/recentSignIn'
import { isRateLimited } from '@/lib/server/rateLimit'
import { INBOX_PROOF_METHODS, INBOX_PROOF_WINDOW_SECONDS } from '@/lib/server/secondFactor'

export type ReauthResult = 'ok' | 'wrong_password' | 'reauth_required' | 'rate_limited'

const ATTEMPTS_PER_WINDOW = 8
const ATTEMPT_WINDOW_SECONDS = 600

/** The caller's own access token: the bearer on native, the session cookie on web. */
export async function accessTokenOf(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim() || null
  try {
    const { data } = await (await createServerSupabase()).auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Checks the password without handing anything to the browser: the sign-in happens on a throwaway server client and
 * its session is revoked at once, so no client session, listener or SIGNED_IN event ever results from re-authenticating.
 */
async function passwordIsCorrect(admin: SupabaseClient, email: string, password: string): Promise<boolean> {
  const probe = createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await probe.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  await admin.auth.admin.signOut(data.session.access_token, 'local').catch(() => undefined)
  return true
}

/**
 * Proof that the person at the keyboard is the account owner, for changing the password or switching 2-step off:
 * the current password, or (recovery link, email code, or an account with no password) a sign-in from the last ten minutes.
 */
export async function verifyReauth(admin: SupabaseClient, identity: RouteIdentity, user: User, currentPassword: string | undefined): Promise<ReauthResult> {
  if (await isRateLimited(admin, `reauth:${identity.id}`, ATTEMPT_WINDOW_SECONDS, ATTEMPTS_PER_WINDOW)) return 'rate_limited'
  if (currentPassword) {
    if (!identity.email) return 'reauth_required'
    return (await passwordIsCorrect(admin, identity.email, currentPassword)) ? 'ok' : 'wrong_password'
  }
  if (signedInWithin(identity.amr, INBOX_PROOF_METHODS, INBOX_PROOF_WINDOW_SECONDS)) return 'ok'
  const hasPassword = (user.app_metadata?.providers as string[] | undefined)?.includes('email') ?? false
  if (!hasPassword && signedInWithin(identity.amr, ['oauth', 'id_token'], INBOX_PROOF_WINDOW_SECONDS)) return 'ok'
  return 'reauth_required'
}
