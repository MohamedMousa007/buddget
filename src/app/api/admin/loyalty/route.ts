import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

const KEY_RE = /^[a-z][a-z0-9_]{1,31}$/

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'loyalty.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const [tiers, accounts, ledger, candidates, founders, nextNumber, billing] = await Promise.all([
    service.from('loyalty_tiers').select('*').order('min_points'),
    service.rpc('admin_loyalty_summary'),
    service.from('loyalty_ledger').select('id, user_id, delta, reason, created_at').order('created_at', { ascending: false }).limit(25),
    service.rpc('admin_founder_candidates'),
    service.from('founders').select('number, user_id, cohort, granted_at, credit_name, credit_name_requested, credit_name_status, retired_at, retired_reason').order('number'),
    service.rpc('loyalty_next_founder_number'),
    service.rpc('admin_billing_counts', { p_days: 30 }),
  ])
  if (tiers.error) return bad('Could not load loyalty.', 500)
  const summary = (accounts.data ?? {}) as { by_tier?: Record<string, number>; members?: number; outstanding?: number }
  return json({ tiers: tiers.data ?? [], byTier: summary.by_tier ?? {}, members: summary.members ?? 0, outstandingPoints: summary.outstanding ?? 0, ledger: ledger.data ?? [], programLive: (tiers.data ?? []).some((t: { status?: string }) => t.status === 'active'), founderCandidates: candidates.data ?? [], pendingFounders: (candidates.data ?? []).length, founders: founders.data ?? [], nextFounderNumber: nextNumber.data ?? null, billing: billing.data ?? null })
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'loyalty.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{
    op?: string
    tier?: { key: string; name: string; description?: string; minPoints?: number; color?: string; perks?: string[]; status?: 'draft' | 'active' | 'archived'; sortOrder?: number }
    key?: string
    userId?: string
    delta?: number
    reason?: string
    approve?: boolean
    creditName?: string
  }>(req)

  // One account at a time, never in bulk: the nightly job only proposes, a number is issued here (S5c item 20).
  if (body?.op === 'founder_decide') {
    if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId) || typeof body.approve !== 'boolean') return bad('Pick one account and approve or reject it.')
    const { data, error } = await ctx.service.rpc('loyalty_decide_founder', { p_user: body.userId, p_actor: ctx.user.id, p_approve: body.approve, p_credit_name: body.creditName ?? undefined })
    if (error) {
      const known: Record<string, string> = { not_pending: 'This account is not waiting for a decision.', program_closed: 'The founder program is not open.', staff: 'Staff accounts do not take founder numbers.', cap_reached: 'All founder numbers are issued.' }
      return bad(known[error.message] ?? 'Could not record the decision.', known[error.message] ? 409 : 500)
    }
    await ctx.audit('loyalty.founder_decide', { targetType: 'user', targetId: body.userId, summary: body.approve ? `Approved founder #${String(data)}` : 'Rejected founder candidate' })
    return json({ ok: true, number: data ?? null })
  }

  // A founder's requested credits name: approved or rejected one at a time. Rejected names are not shown on the list.
  if (body?.op === 'credit_name_decide') {
    if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId) || typeof body.approve !== 'boolean') return bad('Pick one account and approve or reject its name.')
    const { error } = await ctx.service.rpc('loyalty_decide_credit_name', { p_user: body.userId, p_approve: body.approve })
    if (error) return bad(error.message === 'not_pending' ? 'This name is not waiting for a decision.' : 'Could not record the decision.', error.message === 'not_pending' ? 409 : 500)
    await ctx.audit('loyalty.credit_name_decide', { targetType: 'user', targetId: body.userId, summary: body.approve ? 'Approved a credits name' : 'Rejected a credits name' })
    return json({ ok: true })
  }

  if (body?.op === 'upsert_tier' && body.tier) {
    const t = body.tier
    if (!KEY_RE.test(t.key ?? '')) return bad('Tier key must be lowercase letters, numbers or underscores.')
    if (!t.name?.trim()) return bad('Give the tier a name.')
    if (t.status !== undefined && !['draft', 'active', 'archived'].includes(t.status)) return bad('Invalid status.')
    const { error } = await ctx.service.from('loyalty_tiers').upsert({
      key: t.key,
      name: t.name.trim().slice(0, 40),
      description: (t.description ?? '').slice(0, 300),
      min_points: Math.max(0, Math.floor(t.minPoints ?? 0)),
      color: t.color?.slice(0, 20) ?? null,
      perks: (t.perks ?? []).map((p) => String(p).slice(0, 100)).slice(0, 12),
      status: t.status ?? 'draft',
      sort_order: Math.floor(t.sortOrder ?? 0),
    })
    if (error) return bad('Could not save the tier.', 500)
    await ctx.audit('loyalty.tier_upsert', { targetType: 'loyalty_tier', targetId: t.key, summary: `Saved tier ${t.key}` })
    return json({ ok: true })
  }

  if (body?.op === 'delete_tier' && body.key) {
    const { count } = await ctx.service.from('loyalty_accounts').select('user_id', { count: 'exact', head: true }).eq('tier_key', body.key)
    if (count) return bad(`${count} member(s) are in this tier. Archive it instead.`)
    await ctx.service.from('loyalty_tiers').delete().eq('key', body.key)
    await ctx.audit('loyalty.tier_delete', { targetType: 'loyalty_tier', targetId: body.key, summary: `Deleted tier ${body.key}` })
    return json({ ok: true })
  }

  if (body?.op === 'adjust_points') {
    const delta = Math.trunc(Number(body.delta))
    if (!body.userId || !UUID_RE.test(body.userId)) return bad('Pick a user.')
    if (!delta || Math.abs(delta) > 1_000_000) return bad('Enter a non-zero point amount.')
    if (!body.reason?.trim()) return bad('A reason is required.')
    const { data, error } = await ctx.service.rpc('admin_adjust_loyalty_points', { p_user: body.userId, p_delta: delta, p_reason: body.reason.trim(), p_actor: ctx.staff.id })
    if (error?.message.includes('insufficient_points')) return bad('That would take the balance below zero.')
    const result = data?.[0]
    if (error || !result) return bad('Could not adjust points.', 500)
    await ctx.audit('loyalty.adjust', { targetType: 'user', targetId: body.userId, summary: `Adjusted loyalty points by ${delta}`, metadata: { delta, reason: body.reason.slice(0, 200) } })
    return json({ ok: true, balance: result.balance, tier: result.tier })
  }

  return bad('Unknown action.')
}
