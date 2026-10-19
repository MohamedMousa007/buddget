import { guardAdmin, json } from '@/lib/server/admin/guard'
import { clearedSessionCookie, revokeAdminSession, storedSessionId } from '@/lib/server/admin/session'

export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g
  const id = storedSessionId(ctx.session)
  if (id) {
    await revokeAdminSession(ctx.service, id)
    await ctx.audit('auth.logout')
  }
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } })
}
