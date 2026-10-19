import { createClient } from '@supabase/supabase-js'
import { appOrigin } from '@/lib/apiBase'
import type { ServiceClient } from '@/lib/supabase/service'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export const ADMIN_ACCEPT_NEXT = '/admin'

/**
 * Emails a teammate a one-tap link that signs them in and lands on the portal, where first-time setup (admin
 * password + authenticator) takes over. New people get an account invite; people who already have a Buddget
 * account get a magic link. Either way the email comes from the project's auth mailer.
 */
export async function sendStaffInviteEmail(service: ServiceClient, email: string): Promise<boolean> {
  const redirectTo = `${appOrigin()}/auth/callback?next=${encodeURIComponent(ADMIN_ACCEPT_NEXT)}`
  const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (!invited.error) return true
  if (invited.error.code !== 'email_exists' && invited.error.status !== 422) {
    console.error('[admin/invite] invite failed', invited.error.message)
    return false
  }
  const probe = createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await probe.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } })
  if (error) console.error('[admin/invite] magic link failed', error.message)
  return !error
}
