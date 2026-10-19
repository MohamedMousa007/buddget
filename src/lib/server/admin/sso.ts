import type { User } from '@supabase/supabase-js'
import type { ServiceClient } from '@/lib/supabase/service'
import { writeAudit } from './audit'
import { loadCredentials } from './credentials'
import { SESSION_IDLE_MS, SSO_SESSION_ID, type AdminSessionRow } from './session'
import type { StaffContext } from './staff'

const LOGIN_STAMP_EVERY_MS = 60 * 60 * 1000

/**
 * With the person's SSO switch on (the default), a valid app sign-in for an active staff member that finished
 * setup IS the unlocked admin session: access ends exactly when the app sign-in does, and staff status and
 * permissions are re-read on every request. Returns null when the switch is off or setup is not finished.
 */
export async function resolveSsoSession(
  service: ServiceClient,
  user: User,
  staffCtx: StaffContext,
  meta: { ip: string; userAgent: string | null },
  loaded?: Awaited<ReturnType<typeof loadCredentials>>,
): Promise<AdminSessionRow | null> {
  const cred = loaded === undefined ? await loadCredentials(service, user.id) : loaded
  if (!cred?.setup_completed_at || !cred.sso_enabled) return null

  const now = Date.now()
  const last = staffCtx.staff.last_login_at ? new Date(staffCtx.staff.last_login_at).getTime() : 0
  if (now - last > LOGIN_STAMP_EVERY_MS) {
    await service.from('admin_staff').update({ last_login_at: new Date(now).toISOString() }).eq('id', staffCtx.staff.id)
    await writeAudit(service, { actorId: user.id, actorEmail: user.email ?? null, action: 'auth.login', metadata: { via: 'sso' }, ip: meta.ip })
  }
  const since = user.last_sign_in_at ?? new Date(now).toISOString()
  return {
    id: SSO_SESSION_ID,
    user_id: user.id,
    method: 'sso',
    created_at: since,
    last_seen_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_IDLE_MS).toISOString(),
    ip: meta.ip,
    user_agent: meta.userAgent,
  }
}
