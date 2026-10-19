import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'

const STATUSES = ['queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'] as const
const FAILED = ['failed', 'bounced', 'complained']
const PAGE = 50

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'emails.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const p = new URL(req.url).searchParams
  const template = p.get('template')
  const status = p.get('status')
  const locale = p.get('locale')
  const from = p.get('from')
  const to = p.get('to')
  const q = p.get('q')?.trim().replace(/[%,()]/g, '')
  const cursor = p.get('cursor')
  if (status && !(STATUSES as readonly string[]).includes(status)) return bad('Unknown status.')

  // Counts follow every filter except status, so the chips always show how the window splits.
  const base = () => {
    let query = ctx.service.from('email_log').select('id', { count: 'exact', head: true })
    if (template) query = query.eq('template_key', template)
    if (locale) query = query.eq('locale', locale)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)
    if (q && ctx.canSeePii) query = query.ilike('to_email', `%${q}%`)
    return query
  }

  let rows = ctx.service
    .from('email_log')
    .select('id, created_at, user_id, to_email, template_key, locale, provider_message_id, status, error, latency_ms, source, is_test')
    .order('created_at', { ascending: false })
    .limit(PAGE + 1)
  if (template) rows = rows.eq('template_key', template)
  if (locale) rows = rows.eq('locale', locale)
  if (status) rows = rows.eq('status', status)
  if (from) rows = rows.gte('created_at', from)
  if (to) rows = rows.lte('created_at', to)
  if (q && ctx.canSeePii) rows = rows.ilike('to_email', `%${q}%`)
  if (cursor) rows = rows.lt('created_at', cursor)

  const [list, ...counts] = await Promise.all([rows, ...STATUSES.map((s) => base().eq('status', s))])
  if (list.error) return bad('Could not load the log.', 500)
  const byStatus = Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]!.count ?? 0])) as Record<(typeof STATUSES)[number], number>
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  const failed = FAILED.reduce((a, s) => a + byStatus[s as (typeof STATUSES)[number]], 0)
  const page = (list.data ?? []).slice(0, PAGE)

  return json({
    rows: page.map((r) => ({ ...r, to_email: maskIf(ctx, r.to_email) })),
    nextCursor: (list.data?.length ?? 0) > PAGE ? page[page.length - 1]!.created_at : null,
    counts: byStatus,
    total,
    failureRate: total ? failed / total : 0,
    searchEnabled: ctx.canSeePii,
  })
}
