import { FEATURE_CATALOG, LIMIT_CATALOG, isFeatureKey, isLimitKey } from '@/lib/entitlements/limits'
import { can } from '@/lib/admin/permissions'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import type { Json } from '@/lib/supabase/database.types'

const KEY_RE = /^[a-z][a-z0-9_]{1,31}$/

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'billing.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx

  const [plans, entitlements, expiring] = await Promise.all([
    service.from('plans').select('*').order('sort_order').order('created_at'),
    service.rpc('admin_entitlement_counts'),
    service.from('user_entitlements').select('user_id, plan_key, trial_ends_at').eq('status', 'trialing').not('trial_ends_at', 'is', null).order('trial_ends_at').limit(20),
  ])
  if (plans.error) return bad('Could not load plans.', 500)

  const members: Record<string, Record<string, number>> = {}
  let explicit = 0
  for (const e of entitlements.data ?? []) {
    members[e.plan_key] ??= {}
    members[e.plan_key]![e.status] = (members[e.plan_key]![e.status] ?? 0) + e.n
    explicit += e.n
  }
  const { count: totalUsers } = await service.from('profiles').select('id', { count: 'exact', head: true })
  const defaultKey = plans.data?.find((p) => p.is_default)?.key
  if (defaultKey) members[defaultKey] = { ...members[defaultKey], implicit: Math.max((totalUsers ?? 0) - explicit, 0) }

  return json({
    plans: plans.data ?? [],
    members,
    trials: expiring.data ?? [],
    catalog: { limits: LIMIT_CATALOG, features: FEATURE_CATALOG },
    billingLive: false,
  })
}

interface PlanInput {
  key: string
  name: string
  description?: string
  status?: 'draft' | 'active' | 'archived'
  priceMonthlyCents?: number | null
  priceYearlyCents?: number | null
  currency?: string
  trialDays?: number
  limits?: Record<string, number | null>
  features?: string[]
  sortOrder?: number
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'billing.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ op?: string; plan?: PlanInput; key?: string }>(req)

  if (body?.op === 'upsert' && body.plan) {
    const p = body.plan
    if (!KEY_RE.test(p.key ?? '')) return bad('Plan key must be lowercase letters, numbers or underscores.')
    if (!p.name?.trim()) return bad('Give the plan a name.')
    if (p.status !== undefined && !['draft', 'active', 'archived'].includes(p.status)) return bad('Invalid status.')
    const limits: Record<string, number | null> = {}
    for (const [k, v] of Object.entries(p.limits ?? {})) {
      if (!isLimitKey(k)) return bad(`Unknown limit: ${k}`)
      if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return bad(`Invalid value for ${k}`)
      limits[k] = v === null ? null : Math.floor(v)
    }
    const features = (p.features ?? []).filter((f) => typeof f === 'string' && isFeatureKey(f))
    const money = (n: number | null | undefined) => (n == null ? null : Math.max(0, Math.floor(n)))
    const { data: existing } = await ctx.service.from('plans').select('*').eq('key', p.key).maybeSingle()
    if (existing?.is_default && p.status && p.status !== 'active') return bad('The default plan must stay active.')
    const { error } = await ctx.service.from('plans').upsert({
      key: p.key,
      name: p.name.trim().slice(0, 60),
      description: (p.description ?? '').slice(0, 400),
      status: p.status ?? existing?.status ?? 'draft',
      price_monthly_cents: money(p.priceMonthlyCents),
      price_yearly_cents: money(p.priceYearlyCents),
      currency: (p.currency ?? 'USD').toUpperCase().slice(0, 3),
      trial_days: Math.min(Math.max(Math.floor(p.trialDays ?? 0), 0), 365),
      limits: limits as Json,
      features,
      sort_order: Math.floor(p.sortOrder ?? 0),
    })
    if (error) return bad('Could not save the plan.', 500)
    const { data: after } = await ctx.service.from('plans').select('*').eq('key', p.key).maybeSingle()
    await ctx.audit('billing.plan_upsert', { targetType: 'plan', targetId: p.key, summary: `${existing ? 'Edited' : 'Created'} plan ${p.key}`, metadata: { before: (existing ?? null) as Json, after: (after ?? null) as Json } })
    return json({ ok: true })
  }

  if (body?.op === 'set_default' && body.key) {
    const { data: plan } = await ctx.service.from('plans').select('key, status').eq('key', body.key).maybeSingle()
    if (!plan || plan.status !== 'active') return bad('Only an active plan can be the default.')
    await ctx.service.from('plans').update({ is_default: false }).eq('is_default', true)
    await ctx.service.from('plans').update({ is_default: true }).eq('key', body.key)
    await ctx.audit('billing.default_plan', { targetType: 'plan', targetId: body.key, summary: `Made ${body.key} the default plan` })
    return json({ ok: true })
  }

  if (body?.op === 'delete' && body.key) {
    if (!can(ctx.permissions, 'billing.manage')) return bad('Your role does not allow this.', 403)
    const { data: plan } = await ctx.service.from('plans').select('is_default').eq('key', body.key).maybeSingle()
    if (!plan) return bad('Plan not found.', 404)
    if (plan.is_default) return bad('Pick another default plan first.')
    const { count } = await ctx.service.from('user_entitlements').select('user_id', { count: 'exact', head: true }).eq('plan_key', body.key)
    if (count) return bad(`${count} member(s) are on this plan. Archive it instead.`)
    await ctx.service.from('plans').delete().eq('key', body.key)
    await ctx.audit('billing.plan_delete', { targetType: 'plan', targetId: body.key, summary: `Deleted plan ${body.key}` })
    return json({ ok: true })
  }

  return bad('Unknown action.')
}
