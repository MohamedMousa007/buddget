import { guardAdmin, json } from '@/lib/server/admin/guard'
import { clearedSessionCookie, revokeAdminSession } from '@/lib/server/admin/session'

export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok && g.res.status === 403) return g.res
  if (g.ok && g.ctx.session) {
    await revokeAdminSession(g.ctx.service, g.ctx.session.id)
    await g.ctx.audit('auth.logout')
  }
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } })
}
