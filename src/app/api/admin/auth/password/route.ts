import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, clearFailures, isLocked, loadCredentials, recordFailure } from '@/lib/server/admin/credentials'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/admin/crypto'
import { verifyEmailCode } from '@/lib/server/admin/emailCode'
import { revokeAllAdminSessions, storedSessionId } from '@/lib/server/admin/session'

/** Change the admin password. Needs the current password and an emailed code; signs every other session out. */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ current?: string; next?: string; code?: string }>(req)
  if (typeof body?.current !== 'string' || typeof body.next !== 'string' || typeof body.code !== 'string') return bad('Fill in every field.')

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred?.setup_completed_at) return bad('Security is not set up.', 409)
  if (isLocked(cred)) return bad('Too many attempts. Try again later.', 429)
  if (!(await allowAttempt(ctx.service, `admin-password:${ctx.user.id}`, 900, 10))) return bad('Too many attempts. Try again later.', 429)
  const problem = passwordProblem(body.next)
  if (problem) return bad(problem)

  const passwordOk = await verifyPassword(body.current, cred.password_hash)
  const codeOk = !!ctx.user.email && (await verifyEmailCode(ctx.user.email, body.code, ctx.user.id))
  if (!passwordOk || !codeOk) {
    await recordFailure(ctx.service, cred)
    return bad('Current password or code is incorrect.', 401)
  }
  await clearFailures(ctx.service, ctx.user.id)

  await ctx.service.from('admin_credentials').update({ password_hash: await hashPassword(body.next), password_changed_at: new Date().toISOString() }).eq('user_id', ctx.user.id)
  await revokeAllAdminSessions(ctx.service, ctx.user.id, storedSessionId(ctx.session))
  await ctx.audit('auth.password_changed')
  return json({ ok: true })
}
