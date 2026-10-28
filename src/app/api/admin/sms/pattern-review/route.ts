import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { STEP_UP_ERROR, stepUp } from '@/lib/server/admin/stepUp'
import { can } from '@/lib/admin/permissions'
import { computeCountdown, normaliseCoverage, parseKeepDays, validateReview } from '@/lib/admin/patternReview'

/** Migration 0211 (table, pack, coverage) may not be applied yet: every read tolerates its absence. */
interface Loose {
  from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>
}

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const db = g.ctx.service as unknown as Loose
  const view = new URL(req.url).searchParams.get('view') ?? 'overview'

  if (view === 'pack' || view === 'coverage') {
    const today = new Date().toISOString().slice(0, 10)
    let args: Record<string, string> | undefined
    if (view === 'pack') {
      const closed = await db.from('sms_pattern_reviews').select('period_end').in('status', ['reviewed', 'skipped']).order('period_end', { ascending: false }).limit(1)
      const lastEnd = (closed.data?.[0]?.period_end as string | undefined) ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      args = { period_start: lastEnd, period_end: today }
    }
    const { data, error } = await db.rpc(view === 'pack' ? 'sms_review_pack' : 'sms_coverage_by_bank', args)
    if (error || !Array.isArray(data)) return json({ available: false, rows: [] })
    await g.ctx.audit(view === 'pack' ? 'sms.review_pack_downloaded' : 'sms.coverage_viewed', { summary: view === 'pack' ? `Downloaded the masked review pack (${data.length} rows)` : 'Viewed SMS coverage by bank' })
    return json({ available: true, rows: view === 'pack' ? data : normaliseCoverage(data) })
  }

  const setting = await db.from('platform_settings').select('value').eq('key', 'sms_raw_keep_days_parsed').maybeSingle()
  const keepDays = parseKeepDays(setting.data?.value)

  const reviewsRes = await db.from('sms_pattern_reviews').select('id, period_start, period_end, status, notes, report, reviewed_at, created_at').order('created_at', { ascending: false }).limit(10)
  const tableReady = !reviewsRes.error
  const reviews = tableReady ? ((reviewsRes.data ?? []) as Array<{ period_end: string; status: string }>) : []
  const lastClosed = reviews.find((r) => r.status === 'reviewed' || r.status === 'skipped')?.period_end ?? null

  let oldestRawAt: string | null = null
  if (keepDays !== null) {
    let q = db.from('sms_parse_log').select('received_at').not('raw_body', 'is', null).order('received_at', { ascending: true }).limit(1)
    if (lastClosed) q = q.gt('received_at', `${lastClosed}T23:59:59.999Z`)
    const oldest = await q
    oldestRawAt = (oldest.data?.[0]?.received_at as string | undefined) ?? null
  }

  return json({ countdown: computeCountdown(keepDays, oldestRawAt, new Date()), reviews, tableReady, canManage: can(g.ctx.permissions, 'sms.manage') })
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ op?: string; notes?: string; reason?: string; periodStart?: string; code?: string; stepUpPassword?: string }>(req)
  if (!body) return bad('Unknown op.')
  const decision = validateReview(body.op, body.notes, body.reason)
  if (!decision.ok) return bad(decision.error)
  if (!(await stepUp(ctx, body))) return bad(STEP_UP_ERROR, 401)

  const today = new Date().toISOString().slice(0, 10)
  const start = typeof body.periodStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart) ? body.periodStart : today
  const db = ctx.service as unknown as Loose
  const { data, error } = await db.from('sms_pattern_reviews').insert({
    period_start: start > today ? today : start,
    period_end: today,
    status: decision.status,
    notes: decision.notes,
    reviewed_by: ctx.user.id,
    reviewed_at: new Date().toISOString(),
  }).select('id').single()
  if (error) return bad('Could not record the review. The review table may not be installed yet.', 500)

  await ctx.audit(decision.status === 'reviewed' ? 'sms.pattern_review_done' : 'sms.pattern_review_skipped', {
    targetType: 'sms_pattern_review',
    targetId: (data as { id: string }).id,
    summary: decision.status === 'reviewed' ? 'Marked the SMS pattern review as done' : `Skipped the SMS pattern review: ${decision.notes.slice(0, 120)}`,
  })
  return json({ ok: true })
}
