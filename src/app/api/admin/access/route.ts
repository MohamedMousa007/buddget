import { grantState } from '@/lib/admin/grants'
import { guardAdmin, json } from '@/lib/server/admin/guard'

/** The owner's inbox: staff asking for financial access, the access currently open, and the users closed to staff. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'financial.approve' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const now = Date.now()

  const [{ data: grants }, { data: excluded }] = await Promise.all([
    service
      .from('admin_access_grants')
      .select('id, staff_id, target_user_id, reason, ticket_number, requested_at, approved_at, expires_at, revoked_at, denied_at, mode')
      .eq('scope', 'financial')
      .order('requested_at', { ascending: false })
      .limit(200),
    service.from('admin_financial_exclusions').select('user_id, reason, created_at').order('created_at', { ascending: false }).limit(200),
  ])
  const rows = (grants ?? []).map((r) => ({ ...r, state: grantState(r, now) }))
  const open = rows.filter((r) => r.state === 'pending' || r.state === 'active')

  const staffIds = [...new Set(open.map((r) => r.staff_id))]
  const userIds = [...new Set([...open.map((r) => r.target_user_id), ...(excluded ?? []).map((e) => e.user_id)])]
  const [staff, profiles] = await Promise.all([
    staffIds.length ? service.from('admin_staff').select('id, email, display_name').in('id', staffIds) : Promise.resolve({ data: [] as { id: string; email: string; display_name: string | null }[] }),
    userIds.length ? service.from('profiles').select('id, email, name').in('id', userIds) : Promise.resolve({ data: [] as { id: string; email: string | null; name: string | null }[] }),
  ])
  const staffName = new Map((staff.data ?? []).map((s) => [s.id, s.display_name?.trim() || s.email]))
  const userName = new Map((profiles.data ?? []).map((p) => [p.id, p.name?.trim() || p.email || p.id.slice(0, 8)]))

  return json({
    requests: open.filter((r) => r.state === 'pending').map((r) => ({ id: r.id, userId: r.target_user_id, user: userName.get(r.target_user_id) ?? r.target_user_id.slice(0, 8), by: staffName.get(r.staff_id) ?? 'Staff', mode: r.mode, reason: r.reason, ticket: r.ticket_number, requestedAt: r.requested_at })),
    active: open.filter((r) => r.state === 'active').map((r) => ({ id: r.id, userId: r.target_user_id, user: userName.get(r.target_user_id) ?? r.target_user_id.slice(0, 8), by: staffName.get(r.staff_id) ?? 'Staff', mode: r.mode, reason: r.reason, expiresAt: r.expires_at })),
    excluded: (excluded ?? []).map((e) => ({ userId: e.user_id, user: userName.get(e.user_id) ?? e.user_id.slice(0, 8), reason: e.reason, at: e.created_at })),
  })
}
