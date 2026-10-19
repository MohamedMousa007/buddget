import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { STEP_UP_ERROR, stepUp } from '@/lib/server/admin/stepUp'

/**
 * The per-person "stay unlocked while signed in to Buddget" switch. Turning it off is stricter and needs nothing
 * extra; turning it on loosens the portal, so it needs a fresh emailed code or the admin password.
 */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g

  const body = await readJson<{ enabled?: boolean; code?: string; stepUpPassword?: string }>(req)
  if (typeof body?.enabled !== 'boolean') return bad('Say whether to turn it on or off.')

  if (body.enabled && !(await stepUp(ctx, body))) return bad(STEP_UP_ERROR, 401)

  const { error } = await ctx.service.from('admin_credentials').update({ sso_enabled: body.enabled }).eq('user_id', ctx.user.id)
  if (error) return bad('Could not save the setting.', 500)
  await ctx.audit('auth.sso_changed', { metadata: { enabled: body.enabled } })
  return json({ ok: true, ssoEnabled: body.enabled })
}
