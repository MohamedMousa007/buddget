import { smsLocalDay } from '@/lib/sms/ingestGuards'
import { getUserTimeZone } from '@/lib/server/userTimeZone'
import { can } from '@/lib/admin/permissions'
import { GRANT_MINUTES, checkReason, grantExpiry, grantState, isGrantMode, type GrantMode } from '@/lib/admin/grants'
import { emitNotification } from '@/lib/server/emitNotification'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { AUDIT_REFUSAL } from '@/lib/server/admin/audit'
import { blockedTarget, UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

const READS_PER_HOUR = 60
const NOTICE_WINDOW_MS = 10 * 60_000

type Op =
  | { op: 'request'; reason?: string; ticket?: number; mode?: string }
  | { op: 'approve'; grantId?: string; mode?: string }
  | { op: 'deny'; grantId?: string; note?: string }
  | { op: 'revoke'; grantId?: string }
  | { op: 'exclude'; reason?: string }
  | { op: 'include' }
  | { op: 'read' }

/**
 * Financial content is behind a per-user grant. Staff with `financial.request` ask (one time or permanent); only the
 * owner (`financial.approve`) decides, and the owner can put a user out of reach of every staff member. The database
 * refuses a read without a live grant (admin_has_grant), whatever this route does.
 */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'users.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const now = Date.now()
  const isOwner = can(ctx.permissions, 'financial.approve')

  const [{ data: rows }, { data: excl }] = await Promise.all([
    ctx.service
      .from('admin_access_grants')
      .select('id, staff_id, reason, ticket_number, requested_at, approved_at, expires_at, revoked_at, denied_at, mode')
      .eq('target_user_id', id)
      .eq('scope', 'financial')
      .order('requested_at', { ascending: false })
      .limit(20),
    ctx.service.from('admin_financial_exclusions').select('user_id').eq('user_id', id).maybeSingle(),
  ])
  const grants = rows ?? []
  const mine = grants.find((r) => r.staff_id === ctx.staff.id && ['pending', 'active'].includes(grantState(r, now)))
  const pending = isOwner ? grants.filter((r) => grantState(r, now) === 'pending') : []
  const staffIds = [...new Set(pending.map((r) => r.staff_id))]
  const emails = new Map<string, string>()
  if (staffIds.length) {
    const { data: staff } = await ctx.service.from('admin_staff').select('id, email').in('id', staffIds)
    for (const s of staff ?? []) emails.set(s.id, s.email)
  }
  return json({
    isOwner,
    excluded: Boolean(excl),
    canRequest: can(ctx.permissions, 'financial.request'),
    minutes: GRANT_MINUTES,
    mine: mine ? { id: mine.id, state: grantState(mine, now), mode: mine.mode, expiresAt: mine.expires_at, reason: mine.reason, ticket: mine.ticket_number } : null,
    pending: pending.map((r) => ({ id: r.id, by: emails.get(r.staff_id) ?? 'Staff', mode: r.mode, reason: r.reason, ticket: r.ticket_number, requestedAt: r.requested_at })),
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
  const isOwner = can(ctx.permissions, 'financial.approve')

  // The owner may exclude or include any user, including staff and themselves; everyone else cannot act on staff above them.
  const blocked = isOwner && (body.op === 'exclude' || body.op === 'include') ? null : await blockedTarget(ctx, id)
  if (blocked) return bad(blocked, 403)

  switch (body.op) {
    case 'request': {
      if (isOwner) return bad('The owner already has access.')
      if (!can(ctx.permissions, 'financial.request')) return bad('Your role cannot request access.', 403)
      const { data: excluded } = await ctx.service.from('admin_financial_exclusions').select('user_id').eq('user_id', id).maybeSingle()
      if (excluded) return bad('The owner has closed staff access to this account.', 403)
      const reason = checkReason(body.reason)
      if (!reason.ok) return bad(reason.error)
      const mode: GrantMode = isGrantMode(body.mode) ? body.mode : 'one_time'
      const ticket = Number.isInteger(body.ticket) && (body.ticket as number) > 0 ? (body.ticket as number) : null
      const { data: open } = await ctx.service.from('admin_access_grants').select('id, requested_at, approved_at, expires_at, revoked_at, denied_at, mode').eq('staff_id', ctx.staff.id).eq('target_user_id', id).eq('scope', 'financial').order('requested_at', { ascending: false }).limit(5)
      if ((open ?? []).some((r) => ['pending', 'active'].includes(grantState(r, now)))) return bad('You already have a request or open access for this user.')
      const { data: grant, error } = await ctx.service
        .from('admin_access_grants')
        .insert({ staff_id: ctx.staff.id, target_user_id: id, scope: 'financial', reason: reason.reason, ticket_number: ticket, mode })
        .select('id')
        .single()
      if (error || !grant) return bad('Could not save the request.', 500)
      await ctx.audit('pii.financial.request', { targetType: 'user', targetId: id, summary: `Requested ${mode === 'permanent' ? 'permanent' : 'one-time'} financial access`, metadata: { grantId: grant.id, reason: reason.reason, ticket, mode } })
      return json({ ok: true, state: 'pending' })
    }

    case 'approve':
    case 'deny':
    case 'revoke': {
      if (typeof body.grantId !== 'string' || !UUID_RE.test(body.grantId)) return bad('Unknown grant.')
      const { data: grant } = await ctx.service.from('admin_access_grants').select('*').eq('id', body.grantId).eq('target_user_id', id).maybeSingle()
      if (!grant) return bad('Unknown grant.', 404)
      const state = grantState(grant, now)

      if (body.op === 'approve') {
        if (!isOwner) return bad('Only the owner can approve access.', 403)
        if (state !== 'pending') return bad('That request is no longer waiting.')
        const mode: GrantMode = isGrantMode(body.mode) ? body.mode : 'one_time'
        const { data: excluded } = await ctx.service.from('admin_financial_exclusions').select('user_id').eq('user_id', id).maybeSingle()
        if (excluded) return bad('This user is excluded from staff access. Include them first.')
        await ctx.service.from('admin_access_grants').update({ approved_by: ctx.staff.id, approved_at: new Date(now).toISOString(), expires_at: grantExpiry(now, mode), mode }).eq('id', grant.id)
        await ctx.audit('pii.financial.approve', { targetType: 'user', targetId: id, summary: `Approved ${mode === 'permanent' ? 'permanent' : 'one-time'} financial access`, metadata: { grantId: grant.id, staffId: grant.staff_id, mode } })
        return json({ ok: true })
      }
      if (body.op === 'deny') {
        if (!isOwner) return bad('Only the owner can deny access.', 403)
        if (state !== 'pending') return bad('That request is no longer waiting.')
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null
        await ctx.service.from('admin_access_grants').update({ denied_at: new Date(now).toISOString(), note: note || null }).eq('id', grant.id)
        await ctx.audit('pii.financial.deny', { targetType: 'user', targetId: id, summary: 'Denied financial access', metadata: { grantId: grant.id, staffId: grant.staff_id } })
        return json({ ok: true })
      }
      if (grant.staff_id !== ctx.staff.id && !isOwner) return bad('Your role does not allow this.', 403)
      if (state === 'revoked' || state === 'denied') return json({ ok: true })
      await ctx.service.from('admin_access_grants').update({ revoked_at: new Date(now).toISOString() }).eq('id', grant.id)
      await ctx.audit('pii.financial.revoke', { targetType: 'user', targetId: id, summary: 'Closed financial access', metadata: { grantId: grant.id } })
      return json({ ok: true })
    }

    case 'exclude':
    case 'include': {
      if (!isOwner) return bad('Only the owner can do this.', 403)
      if (body.op === 'include') {
        await ctx.service.from('admin_financial_exclusions').delete().eq('user_id', id)
        await ctx.audit('pii.financial.include', { targetType: 'user', targetId: id, summary: 'Allowed staff to ask for financial access again' })
        return json({ ok: true })
      }
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : null
      await ctx.service.from('admin_financial_exclusions').upsert({ user_id: id, excluded_by: ctx.staff.id, reason: reason || null })
      // Closing the door also closes every key already handed out.
      await ctx.service.from('admin_access_grants').update({ revoked_at: new Date(now).toISOString() }).eq('target_user_id', id).eq('scope', 'financial').is('revoked_at', null)
      await ctx.audit('pii.financial.exclude', { targetType: 'user', targetId: id, summary: 'Closed staff access to this user’s financial data', metadata: { reason } })
      return json({ ok: true })
    }

    case 'read': {
      const { data: allowed } = await ctx.service.rpc('api_rate_hit', { p_key: `financial-read:${ctx.staff.id}`, p_window_seconds: 3600, p_max_hits: READS_PER_HOUR })
      if (allowed === false) return bad('Too many reads this hour.', 429)
      const { data: snapshot, error } = await ctx.service.rpc('admin_user_financial_snapshot', { p_staff: ctx.staff.id, p_user: id })
      if (error) return bad(error.code === '42501' ? 'Open financial access first.' : 'Could not load the account.', error.code === '42501' ? 403 : 500)
      const { data: live } = await ctx.service
        .from('admin_access_grants')
        .select('id, ticket_number')
        .eq('staff_id', ctx.staff.id).eq('target_user_id', id).eq('scope', 'financial').is('revoked_at', null).is('denied_at', null).not('approved_at', 'is', null)
        .or(`expires_at.is.null,expires_at.gt.${new Date(now).toISOString()}`)
        .order('requested_at', { ascending: false }).limit(1).maybeSingle()
      const audited = await ctx.audit('pii.financial.read', { targetType: 'user', targetId: id, summary: 'Read a user’s financial details', metadata: { grantId: live?.id } })
      if (audited === false) return bad(AUDIT_REFUSAL, 503)
      // The user is told, in their own activity feed. One line per ten minutes, however often the screen refreshes.
      const ticket = live?.ticket_number ? ` for ticket #${live.ticket_number}` : ''
      await emitNotification(ctx.service, {
        userId: id,
        category: 'support_access',
        severity: 'info',
        dedupeKey: `staff-view:${ctx.staff.id}:${Math.floor(now / NOTICE_WINDOW_MS)}`,
        title: 'Support viewed your account',
        body: `A Buddget team member viewed your financial details on ${smsLocalDay(new Date(now).toISOString(), await getUserTimeZone(ctx.service, id))}${ticket}, to help with your request.`,
        push: false,
      })
      return json({ ok: true, snapshot })
    }
  }
  return bad('Unknown action.')
}
