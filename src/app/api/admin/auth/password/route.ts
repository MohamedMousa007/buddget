import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { consumeSecondFactor, loadCredentials } from '@/lib/server/admin/credentials'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/admin/crypto'
import { revokeAllAdminSessions } from '@/lib/server/admin/session'

/** Change the admin password. Needs the current password and a fresh code; signs every other session out. */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ current?: string; next?: string; code?: string }>(req)
  if (typeof body?.current !== 'string' || typeof body.next !== 'string' || typeof body.code !== 'string') return bad('Fill in every field.')

  const cred = await loadCredentials(ctx.service, ctx.user.id)
  if (!cred) return bad('Security is not set up.', 409)
  const problem = passwordProblem(body.next)
  if (problem) return bad(problem)

  const passwordOk = await verifyPassword(body.current, cred.password_hash)
  const second = await consumeSecondFactor(ctx.service, cred, body.code)
  if (!passwordOk || !second.ok) return bad('Current password or code is incorrect.', 401)

  await ctx.service.from('admin_credentials').update({ password_hash: await hashPassword(body.next), password_changed_at: new Date().toISOString() }).eq('user_id', ctx.user.id)
  await revokeAllAdminSessions(ctx.service, ctx.user.id, ctx.session?.id)
  await ctx.audit('auth.password_changed')
  return json({ ok: true })
}
