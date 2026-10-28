import { emitNotification } from '@/lib/server/emitNotification'
import { can } from '@/lib/admin/permissions'
import { readValidated, ticketUpdateBody } from '@/lib/server/admin/bodySchemas'
import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const CATEGORIES = ['general', 'bug', 'sms', 'sync', 'billing', 'account', 'feature', 'other'] as const
type Status = (typeof STATUSES)[number]
type Priority = (typeof PRIORITIES)[number]
type Category = (typeof CATEGORIES)[number]

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid ticket.')
  const g = await guardAdmin(req, { permission: 'support.view' })
  if (!g.ok) return g.res
  const { ctx } = g

  const [ticket, messages] = await Promise.all([
    ctx.service.from('support_tickets').select('*').eq('id', id).maybeSingle(),
    ctx.service.from('support_ticket_messages').select('id, author_type, author_label, body, internal, created_at').eq('ticket_id', id).order('created_at'),
  ])
  if (!ticket.data) return bad('Ticket not found.', 404)
  return json({ ticket: { ...ticket.data, requester_email: maskIf(ctx, ticket.data.requester_email) }, messages: messages.data ?? [] })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid ticket.')
  const g = await guardAdmin(req, { permission: 'support.reply' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readValidated(req, ticketUpdateBody)

  const { data: ticket } = await ctx.service.from('support_tickets').select('id, number, user_id, subject, status, first_response_at').eq('id', id).maybeSingle()
  if (!ticket) return bad('Ticket not found.', 404)
  const target = { targetType: 'ticket', targetId: id }

  if (body?.op === 'reply') {
    const text = body.message?.trim()
    if (!text) return bad('Write a message first.')
    const internal = body.internal === true
    await ctx.service.from('support_ticket_messages').insert({ ticket_id: id, author_type: 'staff', author_staff_id: ctx.staff.id, author_label: ctx.staff.display_name ?? ctx.staff.email, body: text.slice(0, 10000), internal })
    if (!internal) {
      const update: { first_response_at?: string; status?: Status } = {}
      if (!ticket.first_response_at) update.first_response_at = new Date().toISOString()
      if (ticket.status === 'open') update.status = 'pending'
      if (Object.keys(update).length) await ctx.service.from('support_tickets').update(update).eq('id', id)
      if (ticket.user_id) {
        await emitNotification(ctx.service, {
          userId: ticket.user_id,
          category: 'support_reply',
          severity: 'info',
          dedupeKey: `ticket:${id}:${Date.now()}`,
          title: `Support: ${ticket.subject}`.slice(0, 80),
          body: text.slice(0, 300),
          metadata: { ticketNumber: ticket.number },
        })
      }
    }
    await ctx.audit(internal ? 'support.note' : 'support.reply', { ...target, summary: `${internal ? 'Noted' : 'Replied on'} ticket #${ticket.number}` })
    return json({ ok: true })
  }

  if (body?.op === 'update') {
    const patch: { status?: Status; priority?: Priority; category?: Category; assignee_id?: string | null; tags?: string[]; resolved_at?: string | null } = {}
    if (body.status !== undefined) {
      if (!(STATUSES as readonly string[]).includes(body.status)) return bad('Invalid status.')
      patch.status = body.status as Status
      patch.resolved_at = body.status === 'resolved' || body.status === 'closed' ? new Date().toISOString() : null
    }
    if (body.priority !== undefined) {
      if (!(PRIORITIES as readonly string[]).includes(body.priority)) return bad('Invalid priority.')
      patch.priority = body.priority as Priority
    }
    if (body.category !== undefined) {
      if (!(CATEGORIES as readonly string[]).includes(body.category)) return bad('Invalid category.')
      patch.category = body.category as Category
    }
    if (body.assigneeId !== undefined) {
      if (body.assigneeId !== null && !UUID_RE.test(body.assigneeId)) return bad('Invalid assignee.')
      if (body.assigneeId !== null && body.assigneeId !== ctx.staff.id && !can(ctx.permissions, 'support.manage')) return bad('You can only assign tickets to yourself.', 403)
      patch.assignee_id = body.assigneeId
    }
    if (body.tags !== undefined) patch.tags = body.tags.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10)
    if (Object.keys(patch).length === 0) return bad('Nothing to update.')
    const { error } = await ctx.service.from('support_tickets').update(patch).eq('id', id)
    if (error) return bad('Update failed.', 500)
    await ctx.audit('support.ticket_update', { ...target, summary: `Updated ticket #${ticket.number}`, metadata: patch })
    return json({ ok: true })
  }

  if (body?.op === 'board') {
    if (!can(ctx.permissions, 'support.manage')) return bad('Your role does not allow this.', 403)
    const state = String(body.boardState ?? '')
    if (!['hidden', 'published', 'planned', 'shipped'].includes(state)) return bad('Invalid board state.')
    const title = String(body.boardTitle ?? '').trim().slice(0, 100)
    if (state !== 'hidden' && title.length < 5) return bad('Write a short public title first. Users never see their own wording.')
    const summary = String(body.boardSummary ?? '').trim().slice(0, 400)
    const { error } = await ctx.service.from('support_tickets').update({ board_state: state, board_title: title || null, board_summary: summary || null }).eq('id', id)
    if (error) return bad('Update failed.', 500)
    await ctx.audit('support.board', { ...target, summary: `Set ticket #${ticket.number} on the feedback board to ${state}` })
    return json({ ok: true })
  }

  if (body?.op === 'delete') {
    if (!can(ctx.permissions, 'support.manage')) return bad('Your role does not allow this.', 403)
    await ctx.service.from('support_tickets').delete().eq('id', id)
    await ctx.audit('support.ticket_delete', { ...target, summary: `Deleted ticket #${ticket.number}` })
    return json({ ok: true })
  }

  return bad('Unknown action.')
}
