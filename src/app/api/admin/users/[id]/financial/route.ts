import { can } from '@/lib/admin/permissions'
import { GRANT_MINUTES, checkReason, grantExpiry, grantState } from '@/lib/admin/grants'
import { emitNotification } from '@/lib/server/emitNotification'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { blockedTarget, UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

const READS_PER_HOUR = 60
const NOTICE_WINDOW_MS = 10 * 60_000

type Op =
  | { op: 'request'; reason?: string; ticket?: number }
  | { op: 'approve' | 'extend' | 'revoke'; grantId?: string }
  | { op: 'read' }

/** Who may ask for access: anyone who can see identity. Who may grant it to themselves or others: `users.financial`. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'users.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const now = Date.now()

  const { data: rows } = await ctx.service
    .from('admin_access_grants')
    .select('id, staff_id, reason, ticket_number, requested_at, approved_at, expires_at, revoked_at, extended')
    .eq('target_user_id', id)
    .eq('scope', 'financial')
    .order('requested_at', { ascending: false })
    .limit(10)
  const grants = rows ?? []
  const canApprove = can(ctx.permissions, 'users.financial')
  const mine = grants.find((r) => r.staff_id === ctx.staff.id && ['pending', 'active'].includes(grantState(r, now)))
  const pending = canApprove ? grants.filter((r) => r.staff_id !== ctx.staff.id && grantState(r, now) === 'pending') : []
  return json({
    canRequest: can(ctx.permissions, 'users.financial') || can(ctx.permissions, 'users.pii'),
    selfApproves: canApprove,
    minutes: GRANT_MINUTES,
    mine: mine ? { id: mine.id, state: grantState(mine, now), expiresAt: mine.expires_at, extended: mine.extended, reason: mine.reason, ticket: mine.ticket_number } : null,
    pending: pending.map((r) => ({ id: r.id, reason: r.reason, ticket: r.ticket_number, requestedAt: r.requested_at })),
  })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'users.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<Op>(req)
  if (!body || typeof body.op !== 'string') return bad('Unknown action.')
  const now = Date.now()
  const blocked = await blockedTarget(ctx, id)
  if (blocked) return bad(blocked, 403)

  switch (body.op) {
    case 'request': {
      if (!can(ctx.permissions, 'users.financial') && !can(ctx.permissions, 'users.pii')) return bad('Your role cannot request access.', 403)
      const reason = checkReason(body.reason)
      if (!reason.ok) return bad(reason.error)
      const ticket = Number.isInteger(body.ticket) && (body.ticket as number) > 0 ? (body.ticket as number) : null
      const selfApproves = can(ctx.permissions, 'users.financial')
      const { data: grant, error } = await ctx.service
        .from('admin_access_grants')
        .insert({
          staff_id: ctx.staff.id, target_user_id: id, scope: 'financial', reason: reason.reason, ticket_number: ticket,
          ...(selfApproves ? { approved_by: ctx.staff.id, approved_at: new Date(now).toISOString(), expires_at: grantExpiry(now) } : {}),
        })
        .select('id')
        .single()
      if (error || !grant) return bad('Could not save the request.', 500)
      await ctx.audit('pii.financial.request', { targetType: 'user', targetId: id, summary: selfApproves ? 'Opened financial access for 30 minutes' : 'Requested financial access', metadata: { grantId: grant.id, reason: reason.reason, ticket, selfApproved: selfApproves } })
      return json({ ok: true, state: selfApproves ? 'active' : 'pending' })
    }

    case 'approve':
    case 'extend':
    case 'revoke': {
      if (typeof body.grantId !== 'string' || !UUID_RE.test(body.grantId)) return bad('Unknown grant.')
      const { data: grant } = await ctx.service.from('admin_access_grants').select('*').eq('id', body.grantId).eq('target_user_id', id).maybeSingle()
      if (!grant) return bad('Unknown grant.', 404)
      const state = grantState(grant, now)

      if (body.op === 'approve') {
        if (!can(ctx.permissions, 'users.financial')) return bad('Your role does not allow this.', 403)
        if (state !== 'pending') return bad('That request is no longer waiting.')
        await ctx.service.from('admin_access_grants').update({ approved_by: ctx.staff.id, approved_at: new Date(now).toISOString(), expires_at: grantExpiry(now) }).eq('id', grant.id)
        await ctx.audit('pii.financial.approve', { targetType: 'user', targetId: id, summary: 'Approved financial access', metadata: { grantId: grant.id, staffId: grant.staff_id } })
        return json({ ok: true })
      }
      if (body.op === 'extend') {
        if (grant.staff_id !== ctx.staff.id) return bad('Only the person who holds the grant can extend it.', 403)
        if (state !== 'active') return bad('That access is no longer open.')
        if (grant.extended) return bad('A grant can be extended once.')
        await ctx.service.from('admin_access_grants').update({ expires_at: grantExpiry(now), extended: true }).eq('id', grant.id)
        await ctx.audit('pii.financial.extend', { targetType: 'user', targetId: id, summary: 'Extended financial access', metadata: { grantId: grant.id } })
        return json({ ok: true })
      }
      if (grant.staff_id !== ctx.staff.id && !can(ctx.permissions, 'users.financial')) return bad('Your role does not allow this.', 403)
      if (state === 'revoked') return json({ ok: true })
      await ctx.service.from('admin_access_grants').update({ revoked_at: new Date(now).toISOString() }).eq('id', grant.id)
      await ctx.audit('pii.financial.revoke', { targetType: 'user', targetId: id, summary: 'Closed financial access', metadata: { grantId: grant.id } })
      return json({ ok: true })
    }

    case 'read': {
      const { data: allowed } = await ctx.service.rpc('api_rate_hit', { p_key: `financial-read:${ctx.staff.id}`, p_window_seconds: 3600, p_max_hits: READS_PER_HOUR })
      if (allowed === false) return bad('Too many reads this hour.', 429)
      // The database refuses without a live grant, whatever this route does.
      const { data: snapshot, error } = await ctx.service.rpc('admin_user_financial_snapshot', { p_staff: ctx.staff.id, p_user: id })
      if (error) return bad(error.code === '42501' ? 'Open financial access first.' : 'Could not load the account.', error.code === '42501' ? 403 : 500)
      const { data: live } = await ctx.service
        .from('admin_access_grants')
        .select('id, ticket_number')
        .eq('staff_id', ctx.staff.id).eq('target_user_id', id).eq('scope', 'financial').is('revoked_at', null).gt('expires_at', new Date(now).toISOString())
        .order('expires_at', { ascending: false }).limit(1).maybeSingle()
      await ctx.audit('pii.financial.read', { targetType: 'user', targetId: id, summary: 'Read a user’s financial details', metadata: { grantId: live?.id } })
      // The user is told, in their own activity feed. One line per ten minutes, however often the screen refreshes.
      const ticket = live?.ticket_number ? ` for ticket #${live.ticket_number}` : ''
      await emitNotification(ctx.service, {
        userId: id,
        category: 'support_access',
        severity: 'info',
        dedupeKey: `staff-view:${ctx.staff.id}:${Math.floor(now / NOTICE_WINDOW_MS)}`,
        title: 'Support viewed your account',
        body: `A Buddget team member viewed your financial details on ${new Date(now).toISOString().slice(0, 10)}${ticket}, to help with your request.`,
        push: false,
      })
      return json({ ok: true, snapshot })
    }
  }
  return bad('Unknown action.')
}
