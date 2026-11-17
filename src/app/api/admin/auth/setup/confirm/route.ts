import { bad, guardSignIn, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, loadCredentials } from '@/lib/server/admin/credentials'
import { hashPassword, passwordProblem } from '@/lib/server/admin/crypto'
import { verifyEmailCode } from '@/lib/server/admin/emailCode'
import { createAdminSession, sessionCookie } from '@/lib/server/admin/session'

const CODE_ERROR = 'That code did not match or has expired. Request a new one.'

/**
 * Step 2: the emailed code proves the person reads the staff mailbox; with it they choose the admin password
 * (separate from any buddget password) and the portal opens. Only for staff who have never finished setup.
 */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; code?: string; password?: string }>(req)
  if (typeof body?.email !== 'string' || typeof body.code !== 'string' || typeof body.password !== 'string') return bad('Enter the code and choose a password.')
  const problem = passwordProblem(body.password)
  if (problem) return bad(problem)

  const g = await guardSignIn(req, { email: body.email })
  if (!g.ok) return g.res.status === 401 ? bad(CODE_ERROR, 401) : g.res
  const { ctx } = g

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (cred?.setup_completed_at || !ctx.user.email) return bad(CODE_ERROR, 401)
  if (!(await allowAttempt(ctx.service, `admin-setup-confirm:${ctx.user.id}`, 900, 10))) return bad('Too many attempts. Try again later.', 429)
  if (!(await verifyEmailCode(ctx.user.email, body.code, ctx.user.id))) return bad(CODE_ERROR, 401)

  const now = new Date().toISOString()
  const { error } = await ctx.service.from('admin_credentials').upsert({
    user_id: ctx.user.id,
    password_hash: await hashPassword(body.password),
    setup_completed_at: now,
    failed_attempts: 0,
    locked_until: null,
    password_changed_at: now,
  })
  if (error) {
    console.error('[admin/setup] upsert failed', error.message)
    return bad('Could not finish setup.', 500)
  }
  await ctx.service.from('admin_staff').update({ last_login_at: now }).eq('id', ctx.staff.id)

  const session = await createAdminSession(ctx.service, { userId: ctx.user.id, method: 'password_email', ip: ctx.ip, userAgent: ctx.userAgent })
  await ctx.audit('auth.setup_completed')
  return json({ token: session.token, expiresAt: session.expiresAt }, { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } })
}
