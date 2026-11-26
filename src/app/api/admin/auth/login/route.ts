import { SIGN_IN_ERROR, bad, guardSignIn, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, clearFailures, isLocked, loadCredentials, recordFailure } from '@/lib/server/admin/credentials'
import { hashPassword, verifyPassword } from '@/lib/server/admin/crypto'
import { verifyEmailCode } from '@/lib/server/admin/emailCode'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

const MAX_PASSWORD_LENGTH = 200

/** Sign in to the portal: staff email, admin password and the code emailed to that address. The buddget app sign-in plays no part. */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; password?: string; code?: string }>(req)
  if (typeof body?.email !== 'string' || typeof body.password !== 'string' || typeof body.code !== 'string' || body.password.length > MAX_PASSWORD_LENGTH) {
    return bad('Enter your email, password and code.')
  }

  const g = await guardSignIn(req, { email: body.email })
  if (!g.ok) {
    // Spend the same work an unknown address would have skipped, so the answer time says nothing.
    if (g.res.status === 401) await hashPassword(body.password)
    return g.res
  }
  const { ctx } = g

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) {
    await hashPassword(body.password)
    return bad(SIGN_IN_ERROR, 401)
  }
  if (isLocked(cred)) {
    await hashPassword(body.password)
    return bad(SIGN_IN_ERROR, 401)
  }
  if (!(await allowAttempt(ctx.service, `admin-login:${ctx.user.id}`, 900, 12))) return bad('Too many attempts. Try again later.', 429)

  // Both factors are always evaluated so a wrong password and a wrong code are indistinguishable.
  const passwordOk = await verifyPassword(body.password, cred.password_hash)
  const codeOk = !!ctx.user.email && (await verifyEmailCode(ctx.user.email, body.code, ctx.user.id))
  if (!passwordOk || !codeOk) {
    const { locked } = await recordFailure(ctx.service, cred)
    await ctx.audit('auth.login_failed', { metadata: { locked } })
    return bad(SIGN_IN_ERROR, 401)
  }

  await clearFailures(ctx.service, ctx.user.id)
  await ctx.service.from('admin_staff').update({ last_login_at: new Date().toISOString() }).eq('id', ctx.staff.id)
  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'password_email', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.login', { metadata: { via: 'password_email' } })
  return json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
