import { guardAdmin, json } from '@/lib/server/admin/guard'
import { clearedSessionCookie, revokeAdminSession } from '@/lib/server/admin/session'

export async function POST(req: Request) {
  const g = await guardAdmin(req, { sessionOptional: true })
  if (!g.ok) return g.res
  const { ctx } = g
  if (ctx.session) {
    await revokeAdminSession(ctx.service, ctx.session.id)
    await ctx.audit('auth.logout')
  }
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } })
}
