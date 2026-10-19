import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, clearFailures, isLocked, loadCredentials, recordFailure } from '@/lib/server/admin/credentials'
import { verifyPassword } from '@/lib/server/admin/crypto'
import { verifyEmailCode } from '@/lib/server/admin/emailCode'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

/** Unlock the portal (SSO off): admin password plus the code emailed to the account, on top of the app sign-in. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ password?: string; code?: string }>(req)
  if (typeof body?.password !== 'string' || typeof body.code !== 'string') return bad('Enter your password and code.')

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) return json({ error: 'Finish security setup first.', code: 'setup_required' }, 409)

  if (isLocked(cred)) return bad('Too many failed attempts. Try again in 15 minutes.', 429)
  const throttled =
    !(await allowAttempt(ctx.service, `admin-login:${ctx.user.id}`, 900, 12)) ||
    !(await allowAttempt(ctx.service, `admin-login-ip:${ctx.ip}`, 900, 30))
  if (throttled) return bad('Too many attempts. Try again later.', 429)

  // Both factors are always evaluated so a wrong password and a wrong code are indistinguishable.
  const passwordOk = await verifyPassword(body.password, cred.password_hash)
  const codeOk = !!ctx.user.email && (await verifyEmailCode(ctx.user.email, body.code, ctx.user.id))
  if (!passwordOk || !codeOk) {
    const { locked } = await recordFailure(ctx.service, cred)
    await ctx.audit('auth.login_failed', { metadata: { locked } })
    return bad(locked ? 'Too many failed attempts. Locked for 15 minutes.' : 'Incorrect password or code.', 401)
  }

  await clearFailures(ctx.service, ctx.user.id)
  await ctx.service.from('admin_staff').update({ last_login_at: new Date().toISOString() }).eq('id', ctx.staff.id)
  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'password_email', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.login', { metadata: { via: 'password_email' } })
  return json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
