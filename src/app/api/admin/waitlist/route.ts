import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { auditPiiRead } from '@/lib/server/admin/staffActionGuards'

const PAGE = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const COLUMNS = 'id, email, name, country, platform, tracking_now, want_most, heard_from, share_code, referred_by, app_invite_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, locale, created_at'

function parseCursor(raw: string | null): { ts: string; id: string } | null {
  const [ts, id] = (raw ?? '').split('|')
  return ts && TIMESTAMP.test(ts) && Number.isFinite(Date.parse(ts)) && id && UUID.test(id) ? { ts, id } : null
}

/** Website waitlist (`waitlist_signups`), newest first, 1000 per page by keyset. Read-only; rows expire after 180 days. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'leads.view' })
  if (!g.ok) return g.res
  const cursor = parseCursor(new URL(req.url).searchParams.get('cursor'))

  let q = g.ctx.service.from('waitlist_signups').select(COLUMNS)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE)
  if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`)
  const { data, error } = await q
  if (error) return bad('Could not load the waitlist.', 500)

  await auditPiiRead(g.ctx, 'waitlist_list', 'waitlist_signup', null, { onlyWithPii: false })
  const rows = (data ?? []).map((r) => ({
    ...r,
    email: maskIf(g.ctx, r.email),
    name: g.ctx.canSeePii || !r.name ? r.name : `${Array.from(r.name)[0]}***`,
  }))
  const last = data?.[PAGE - 1]
  return json({ rows, nextCursor: last ? `${last.created_at}|${last.id}` : null })
}
