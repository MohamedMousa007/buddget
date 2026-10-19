import { appOrigin } from '@/lib/apiBase'
import { adminOriginFor } from '@/lib/admin/host'
import type { ServiceClient } from '@/lib/supabase/service'
import { ADMIN_INVITE_SUBJECT, adminInviteHtml } from './inviteEmailHtml'

export const ADMIN_ACCEPT_NEXT = '/admin'

const DEFAULT_FROM = 'Buddget <no-reply@buddget.app>'

/**
 * Emails a teammate the admin invite: a one-tap link that signs them in and lands on the portal, where first-time
 * setup (admin password + emailed code) takes over. The link is minted without sending anything, then mailed by us,
 * so new people and people who already have a Buddget account get the same invite and the project's
 * magic-link and code emails stay for ordinary sign-in only.
 */
export async function sendStaffInviteEmail(service: ServiceClient, email: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.error('[admin/invite] RESEND_API_KEY is not set')
    return false
  }
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
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM, to: [email], subject: ADMIN_INVITE_SUBJECT, html: adminInviteHtml(url) }),
  })
  if (!res.ok) console.error('[admin/invite] send failed', res.status, await res.text().catch(() => ''))
  return res.ok
}
