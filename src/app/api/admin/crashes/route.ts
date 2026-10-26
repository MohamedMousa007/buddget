import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

const STATUSES = ['new', 'acknowledged', 'resolved'] as const
const DAY_MS = 86_400_000

/** App crashes and errors (fed by the Sentry webhook), grouped by issue and release. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'crashes.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const url = new URL(req.url)
  const release = url.searchParams.get('release')
  const platform = url.searchParams.get('platform')
  const status = url.searchParams.get('status')

  let q = service.from('client_crashes').select('*').order('last_seen', { ascending: false }).limit(200)
  if (release) q = q.eq('release', release)
  if (platform) q = q.eq('platform', platform)
  if (status && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return bad('Could not load crashes.', 500)
  const rows = data ?? []

  const { data: recent } = await service.from('client_crashes').select('release, platform, user_id, occurrences, first_seen, last_seen').gte('last_seen', new Date(Date.now() - 30 * DAY_MS).toISOString()).limit(5000)
  const all = recent ?? []
  const dayAgo = Date.now() - DAY_MS
  const releases = [...new Set(all.map((r) => r.release).filter(Boolean))].sort().reverse()
  const stats = {
    newToday: all.filter((r) => Date.parse(r.first_seen) >= dayAgo).length,
    seen7d: all.filter((r) => Date.parse(r.last_seen) >= Date.now() - 7 * DAY_MS).length,
    affectedUsers: new Set(all.map((r) => r.user_id).filter(Boolean)).size,
    open: rows.filter((r) => r.status !== 'resolved').length,
  }
  return json({ rows, stats, releases })
}

/** Acknowledge or resolve an issue. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'crashes.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ id?: string; status?: string }>(req)
  if (typeof body?.id !== 'string' || !UUID_RE.test(body.id) || !(STATUSES as readonly string[]).includes(body.status ?? '')) return bad('Unknown action.')
  const { error } = await ctx.service.from('client_crashes').update({ status: body.status }).eq('id', body.id)
  if (error) return bad('Could not update the crash.', 500)
  await ctx.audit('crash.status', { targetType: 'crash', targetId: body.id, summary: `Marked a crash ${body.status}` })
  return json({ ok: true })
}
