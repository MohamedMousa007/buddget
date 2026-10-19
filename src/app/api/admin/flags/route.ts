import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'

const KEY_RE = /^[a-z][a-z0-9_.-]{1,63}$/
const PLATFORMS = ['ios', 'android', 'web']

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'flags.view' })
  if (!g.ok) return g.res
  const [flags, plans] = await Promise.all([
    g.ctx.service.from('feature_flags').select('*').order('key'),
    g.ctx.service.from('plans').select('key, name').neq('status', 'archived').order('sort_order'),
  ])
  if (flags.error) return bad('Could not load flags.', 500)
  return json({ flags: flags.data ?? [], plans: plans.data ?? [] })
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'flags.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{
    op?: string
    key?: string
    flag?: { key: string; description?: string; enabled?: boolean; rolloutPct?: number; planKeys?: string[]; platforms?: string[] }
  }>(req)

  if (body?.op === 'upsert' && body.flag) {
    const f = body.flag
    if (!KEY_RE.test(f.key ?? '')) return bad('Flag keys use lowercase letters, numbers, dots, dashes and underscores.')
    const { data: before } = await ctx.service.from('feature_flags').select('enabled, rollout_pct').eq('key', f.key).maybeSingle()
    const { error } = await ctx.service.from('feature_flags').upsert({
      key: f.key,
      description: (f.description ?? '').slice(0, 300),
      enabled: !!f.enabled,
      rollout_pct: Math.min(Math.max(Math.floor(f.rolloutPct ?? 100), 0), 100),
      plan_keys: (f.planKeys ?? []).slice(0, 20),
      platforms: (f.platforms ?? []).filter((p) => PLATFORMS.includes(p)),
      updated_by: ctx.staff.id,
    })
    if (error) return bad('Could not save the flag.', 500)
    await ctx.audit('flags.upsert', {
      targetType: 'flag',
      targetId: f.key,
      summary: before ? `Changed flag ${f.key}` : `Created flag ${f.key}`,
      metadata: { enabled: !!f.enabled, rolloutPct: f.rolloutPct, before },
    })
    return json({ ok: true })
  }

  if (body?.op === 'delete' && body.key) {
    await ctx.service.from('feature_flags').delete().eq('key', body.key)
    await ctx.audit('flags.delete', { targetType: 'flag', targetId: body.key, summary: `Deleted flag ${body.key}` })
    return json({ ok: true })
  }
  return bad('Unknown action.')
}
