import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, isLocked, loadCredentials, recordFailure } from '@/lib/server/admin/credentials'
import { verifyEmailCode } from '@/lib/server/admin/emailCode'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

/** Step 2: the emailed code proves mailbox ownership, completes setup and opens the portal. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ code?: string }>(req)
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred || cred.setup_completed_at) return bad('Start setup first.', 409)
  if (typeof body?.code !== 'string') return bad('Enter the 6-digit code.')
  if (isLocked(cred)) return bad('Too many failed attempts. Try again in 15 minutes.', 429)
  if (!(await allowAttempt(ctx.service, `admin-setup-confirm:${ctx.user.id}`, 900, 10))) return bad('Too many attempts. Try again later.', 429)

  if (!ctx.user.email || !(await verifyEmailCode(ctx.user.email, body.code, ctx.user.id))) {
    await recordFailure(ctx.service, cred)
    return bad('That code did not match or has expired. Request a new one.', 401)
  }

  const now = new Date().toISOString()
  await ctx.service.from('admin_credentials').update({ setup_completed_at: now, failed_attempts: 0, locked_until: null }).eq('user_id', ctx.user.id)
  await ctx.service.from('admin_staff').update({ last_login_at: now }).eq('id', ctx.staff.id)

  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'password_email', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.setup_completed')
  return json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
