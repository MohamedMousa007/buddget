import { can } from '@/lib/admin/permissions'
import { isSwitchKey, REWARDS_READ_PERMISSIONS, SWITCH_KEYS, SWITCH_PERMISSION } from '@/lib/admin/rewardsOps'
import { rewardsAdmin } from '@/lib/server/rewardsAdmin'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'

/** The four platform switches for Pro, tiers, invites and tier Spark gifts. Reading needs any rewards permission. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: [...REWARDS_READ_PERMISSIONS, 'platform.view'] })
  if (!g.ok) return g.res
  const { data, error } = await g.ctx.service.from('platform_settings').select('key, value, updated_at').in('key', [...SWITCH_KEYS])
  if (error) return bad('Could not load the switches.', 500)
  const rows = new Map((data ?? []).map((r) => [r.key, r]))
  return json({
    switches: SWITCH_KEYS.map((key) => {
      const value = rows.get(key)?.value as { enabled?: unknown } | null | undefined
      return { key, enabled: value?.enabled === true, updatedAt: rows.get(key)?.updated_at ?? null }
    }),
  })
}

/** Flips one switch; each switch needs its own permission. Audit-logged by the SQL function. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: Object.values(SWITCH_PERMISSION) })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ key?: unknown; enabled?: unknown }>(req)
  if (!isSwitchKey(body?.key) || typeof body.enabled !== 'boolean') return bad('Pick a switch and on or off.')
  if (!can(ctx.permissions, SWITCH_PERMISSION[body.key])) return bad('Your role does not allow this.', 403)
  const result = await rewardsAdmin(ctx.service, ctx.user.id).setSwitch(body.key, body.enabled)
  if (result.status !== 'ok') return bad('Could not change the switch.', result.status === 'invalid' ? 400 : 500)
  return json({ ok: true, key: body.key, enabled: body.enabled })
}
