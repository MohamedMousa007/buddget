import { bad, guardSignIn, json, readJson } from '@/lib/server/admin/guard'
import { allowAttempt, loadCredentials } from '@/lib/server/admin/credentials'
import { sendEmailCode } from '@/lib/server/admin/emailCode'

/**
 * Step 1 of first-time setup: a staff member who has no admin password yet asks for a code at their staff address.
 * The answer is always the same, whether or not the address is on the team or already set up.
 */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string }>(req)
  if (typeof body?.email !== 'string' || !body.email.trim()) return bad('Enter your staff email.')

  const g = await guardSignIn(req, { email: body.email })
  if (!g.ok) return g.res.status === 401 ? json({ ok: true }) : g.res
  const { ctx } = g

  const existing = await loadCredentials(ctx.service, ctx.user.id)
  if (existing?.setup_completed_at || !ctx.user.email) return json({ ok: true })
  if (!(await allowAttempt(ctx.service, `admin-setup:${ctx.user.id}`, 900, 6))) return json({ ok: true })

  const sent = await sendEmailCode(ctx.service, ctx.user.email, ctx.user.id)
  if (sent.ok) await ctx.audit('auth.setup_started')
  return json({ ok: true })
}
