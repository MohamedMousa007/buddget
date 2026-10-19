import { appOrigin } from '@/lib/apiBase'
import { adminOriginFor } from '@/lib/admin/host'
import { sendTemplatedEmail } from '@/lib/server/email/send'
import type { ServiceClient } from '@/lib/supabase/service'

export const ADMIN_ACCEPT_NEXT = '/admin'

/**
 * Emails a teammate the admin invite: a one-tap link that signs them in and lands on the portal, where first-time
 * setup (admin password + emailed code) takes over. The link is minted without sending anything, then mailed by us,
 * so new people and people who already have a Buddget account get the same invite and the project's
 * magic-link and code emails stay for ordinary sign-in only.
 */
export async function sendStaffInviteEmail(service: ServiceClient, email: string, extra: { inviterName?: string; role?: string } = {}): Promise<boolean> {
  const redirectTo = `${adminOriginFor(appOrigin())}/auth/callback?next=${encodeURIComponent(ADMIN_ACCEPT_NEXT)}`
  let link = await service.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } })
  if (link.error && (link.error.code === 'email_exists' || link.error.status === 422)) {
    link = await service.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
  }
  const url = link.data?.properties?.action_link
  if (link.error || !url) {
    console.error('[admin/invite] link failed', link.error?.message)
    return false
  }
  const sent = await sendTemplatedEmail('invite_admin', { email }, { link: url, inviter_name: extra.inviterName, role: extra.role }, { service, source: 'admin' })
  return sent.ok
}
