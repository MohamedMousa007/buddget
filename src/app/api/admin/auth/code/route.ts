import { SIGN_IN_ERROR, bad, guardAdmin, guardSignIn, json, readJson, type AdminContext } from '@/lib/server/admin/guard'
import { allowAttempt, isLocked, loadCredentials, recordFailure } from '@/lib/server/admin/credentials'
import { hashPassword, verifyPassword } from '@/lib/server/admin/crypto'
import { sendEmailCode } from '@/lib/server/admin/emailCode'

async function send(ctx: AdminContext) {
  if (!ctx.user.email) return bad('This account has no email.', 409)
  if (!(await allowAttempt(ctx.service, `admin-code:${ctx.user.id}`, 3600, 8))) return bad('Too many codes requested. Try again later.', 429)
  const sent = await sendEmailCode(ctx.service, ctx.user.email, ctx.user.id)
  if (!sent.ok) return bad(sent.status === 429 ? 'Please wait a minute before asking for another code.' : 'We could not send the code. Try again.', sent.status)
  await ctx.audit('auth.code_sent')
  return json({ ok: true })
}

/**
 * Emails a staff member a fresh 6-digit code, only ever to their own address.
 * - Signing in (`email` + `password` in the body): the first step of sign-in. The code is sent only when the admin
 *   password is right, so nobody can use this to flood a staff mailbox or to learn who is on the team.
 * - Signed in: for step-up and security changes; what the code unlocks is decided by the endpoint that verifies it.
 */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; password?: string }>(req)
  if (typeof body?.email !== 'string') {
    const g = await guardAdmin(req)
    return g.ok ? send(g.ctx) : g.res
  }

  const password = body.password
  if (typeof password !== 'string' || !password || password.length > 200) return bad('Enter your email and password.')
  const g = await guardSignIn(req, { email: body.email })
  if (!g.ok) {
    if (g.res.status === 401) await hashPassword(password)
    return g.res
  }
  const { ctx } = g
  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) {
    await hashPassword(password)
    return bad(SIGN_IN_ERROR, 401)
  }
  if (isLocked(cred)) return bad('Too many failed attempts. Try again in 15 minutes.', 429)
  if (!(await verifyPassword(password, cred.password_hash))) {
    const { locked } = await recordFailure(ctx.service, cred)
    await ctx.audit('auth.login_failed', { metadata: { locked, step: 'password' } })
    return bad(locked ? 'Too many failed attempts. Locked for 15 minutes.' : SIGN_IN_ERROR, 401)
  }
  return send(ctx)
}
