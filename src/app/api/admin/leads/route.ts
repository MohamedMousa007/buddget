import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { auditPiiRead } from '@/lib/server/admin/staffActionGuards'

const KINDS = ['waitlist', 'contact'] as const

/** Contact messages and waitlist sign-ups from the public website (`site_leads`), newest first. Read-only; rows expire after 180 days. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'leads.view' })
  if (!g.ok) return g.res
  const kind = new URL(req.url).searchParams.get('kind')

  let q = g.ctx.service.from('site_leads').select('id, kind, email, name, message, locale, created_at').order('created_at', { ascending: false }).limit(200)
  if (kind && (KINDS as readonly string[]).includes(kind)) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) return bad('Could not load website leads.', 500)

  await auditPiiRead(g.ctx, 'lead_list', 'site_lead', null, { onlyWithPii: false })
  const rows = (data ?? []).map((r) => ({ ...r, email: maskIf(g.ctx, r.email) }))
  return json({ rows })
}
