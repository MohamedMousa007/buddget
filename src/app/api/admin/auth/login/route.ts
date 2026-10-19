import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import {
  allowAttempt,
  clearFailures,
  consumeSecondFactor,
  isLocked,
  loadCredentials,
  recordFailure,
} from '@/lib/server/admin/credentials'
import { verifyPassword } from '@/lib/server/admin/crypto'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

/** Unlock the portal: admin password plus an authenticator (or recovery) code, on top of the app sign-in. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ password?: string; code?: string }>(req)
  if (typeof body?.password !== 'string' || typeof body.code !== 'string') return bad('Enter your password and code.')

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.totp_confirmed_at) return json({ error: 'Finish security setup first.', code: 'setup_required' }, 409)

  if (isLocked(cred)) return bad('Too many failed attempts. Try again in 15 minutes.', 429)
  const throttled =
    !(await allowAttempt(ctx.service, `admin-login:${ctx.user.id}`, 900, 12)) ||
    !(await allowAttempt(ctx.service, `admin-login-ip:${ctx.ip}`, 900, 30))
  if (throttled) return bad('Too many attempts. Try again later.', 429)

  // Both factors are always evaluated so a wrong password and a wrong code are indistinguishable.
  const passwordOk = await verifyPassword(body.password, cred.password_hash)
  const second = await consumeSecondFactor(ctx.service, cred, body.code)
  if (!passwordOk || !second.ok) {
    const { locked } = await recordFailure(ctx.service, cred)
    await ctx.audit('auth.login_failed', { metadata: { locked } })
    return bad(locked ? 'Too many failed attempts. Locked for 15 minutes.' : 'Incorrect password or code.', 401)
  }

  await clearFailures(ctx.service, ctx.user.id)
  await ctx.service.from('admin_staff').update({ last_login_at: new Date().toISOString() }).eq('id', ctx.staff.id)
  const session = await createAdminSession(ctx.service, {
    userId: ctx.user.id,
    method: second.via === 'recovery' ? 'recovery' : 'password_totp',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  })
  await ctx.audit('auth.login', { metadata: { via: second.via } })
  return json(
    { token: session.token, expiresAt: session.expiresAt, recoveryCodesLeft: second.via === 'recovery' ? cred.recovery_hashes.length - 1 : undefined },
    { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } },
  )
}
