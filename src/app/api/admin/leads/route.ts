import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { auditPiiRead } from '@/lib/server/admin/staffActionGuards'

const KINDS = ['waitlist', 'contact'] as const
const PAGE = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Kept verbatim (microseconds): rounding to milliseconds could skip a row written in the same millisecond.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const PREVIEW_CHARS = 40

const maskName = (name: string | null) => (name ? `${Array.from(name)[0]}***` : null)
/** `<created_at ISO>|<id>` of the last row seen; null when absent or malformed (then the first page is served). */
function parseCursor(raw: string | null): { ts: string; id: string } | null {
  const [ts, id] = (raw ?? '').split('|')
  return ts && TIMESTAMP.test(ts) && Number.isFinite(Date.parse(ts)) && id && UUID.test(id) ? { ts, id } : null
}
const maskMessage = (m: string | null) => (m && Array.from(m).length > PREVIEW_CHARS ? `${Array.from(m).slice(0, PREVIEW_CHARS).join('')}...` : m)

/** Contact messages and waitlist sign-ups from the public website (`site_leads`), newest first. Read-only; rows expire after 180 days. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'leads.view' })
  if (!g.ok) return g.res
  const params = new URL(req.url).searchParams
  const kind = params.get('kind')
  const cursor = parseCursor(params.get('cursor'))

  // QA-58: keyset on (created_at, id), so a lead arriving between pages neither repeats nor skips a row.
  let q = g.ctx.service.from('site_leads').select('id, kind, email, name, message, locale, created_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE)
  if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`)
  if (kind && (KINDS as readonly string[]).includes(kind)) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) return bad('Could not load website leads.', 500)

  await auditPiiRead(g.ctx, 'lead_list', 'site_lead', null, { onlyWithPii: false })
  // Names and free-text messages carry the same personal data as the address: without users.pii only a preview is shown.
  const rows = (data ?? []).map((r) => ({
    ...r,
    email: maskIf(g.ctx, r.email),
    name: g.ctx.canSeePii ? r.name : maskName(r.name),
    message: g.ctx.canSeePii ? r.message : maskMessage(r.message),
  }))
  const last = data?.[PAGE - 1]
  return json({ rows, nextCursor: last ? `${last.created_at}|${last.id}` : null })
}
