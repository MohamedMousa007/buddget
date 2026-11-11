import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { auditPiiRead } from '@/lib/server/admin/staffActionGuards'

const KINDS = ['waitlist', 'contact'] as const
const PAGE = 200
const MAX_OFFSET = 100_000
const PREVIEW_CHARS = 40

const maskName = (name: string | null) => (name ? `${Array.from(name)[0]}***` : null)
const maskMessage = (m: string | null) => (m && Array.from(m).length > PREVIEW_CHARS ? `${Array.from(m).slice(0, PREVIEW_CHARS).join('')}...` : m)

/** Contact messages and waitlist sign-ups from the public website (`site_leads`), newest first. Read-only; rows expire after 180 days. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'leads.view' })
  if (!g.ok) return g.res
  const params = new URL(req.url).searchParams
  const kind = params.get('kind')
  const offset = Math.min(Math.max(Math.floor(Number(params.get('offset'))) || 0, 0), MAX_OFFSET)

  let q = g.ctx.service.from('site_leads').select('id, kind, email, name, message, locale, created_at').order('created_at', { ascending: false }).range(offset, offset + PAGE - 1)
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
  return json({ rows, nextOffset: rows.length === PAGE ? offset + PAGE : null })
}
