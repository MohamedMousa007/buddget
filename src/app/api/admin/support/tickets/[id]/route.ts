import { contentDedupeKey } from '@/lib/server/notificationDedupe'
import { emitNotification } from '@/lib/server/emitNotification'
import { can } from '@/lib/admin/permissions'
import { readValidated, ticketUpdateBody } from '@/lib/server/admin/bodySchemas'
import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'
import { supportRecipient } from '@/lib/server/supportRecipient'
import { getUserDictionary } from '@/lib/server/userDictionary'
import { renderServerCopy } from '@/lib/notifications/serverCopy'
import { signThreadAttachments } from '@/lib/server/supportAttachments'
import { applyMacroVars, nextReadMark, staffFirstName } from '@/lib/support/conversation'
import { SUPPORT_REPLY_KIND, supportReplyPush } from '@/lib/support/pushCopy'

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
    ctx.service.from('support_ticket_messages').select('id, author_type, author_label, body, internal, created_at, attachments').eq('ticket_id', id).order('created_at'),
  ])
  if (!ticket.data) return bad('Ticket not found.', 404)
  const list = messages.data ?? []
  // A teammate opening the ticket reads it for the desk: the "new reply" dot clears up to the newest message shown.
  const mark = nextReadMark(list, ticket.data.staff_last_read_at)
  if (mark) await ctx.service.from('support_tickets').update({ staff_last_read_at: mark }).eq('id', id)
  return json({ ticket: { ...ticket.data, requester_email: maskIf(ctx, ticket.data.requester_email) }, messages: await signThreadAttachments(ctx.service, list) })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid ticket.')
  const g = await guardAdmin(req, { permission: 'support.reply' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readValidated(req, ticketUpdateBody)

  const { data: ticket } = await ctx.service.from('support_tickets').select('id, number, user_id, subject, status, priority, category, created_at, first_response_at').eq('id', id).maybeSingle()
  if (!ticket) return bad('Ticket not found.', 404)
  const target = { targetType: 'ticket', targetId: id }

  if (body?.op === 'reply') {
    const text = body.message?.trim()
    if (!text) return bad('Write a message first.')
    const internal = body.internal === true
    // A reply only reaches the person through an in-app notification: with no app account it would be saved and audited but never sent.
    if (!internal && !ticket.user_id) return bad('This ticket has no app account to notify. Save it as an internal note, or reply by email.', 409)
    const recipient = !internal && ticket.user_id ? await supportRecipient(ctx.service, ticket.user_id) : null
    const finalText = (internal ? text : applyMacroVars(text, { firstName: recipient?.firstName })).slice(0, 10000)
    await ctx.service.from('support_ticket_messages').insert({ ticket_id: id, author_type: 'staff', author_staff_id: ctx.staff.id, author_label: ctx.staff.display_name ?? ctx.staff.email, body: finalText, internal })
    if (!internal) {
      const update: { first_response_at?: string; status?: Status } = {}
      if (!ticket.first_response_at) update.first_response_at = new Date().toISOString()
      if (ticket.status === 'open') update.status = 'pending'
      if (Object.keys(update).length) await ctx.service.from('support_tickets').update(update).eq('id', id)
      if (ticket.user_id) {
        const push = supportReplyPush({ locale: recipient?.locale, staffFirstName: staffFirstName(ctx.staff.display_name), number: ticket.number, message: finalText })
        await emitNotification(ctx.service, {
          userId: ticket.user_id,
          category: SUPPORT_REPLY_KIND,
          severity: 'info',
          dedupeKey: contentDedupeKey(`ticket:${id}`, ticket.subject, finalText, Date.now()),
          title: push.title,
          body: push.body,
          metadata: { ticketNumber: ticket.number },
          push: { data: push.data, collapseKey: `ticket-${ticket.number}` },
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
    // Resolving tells the person (and the thread then asks how we did); the dedupe key makes it once per ticket.
    if (patch.status === 'resolved' && ticket.status !== 'resolved' && ticket.user_id) {
      await emitNotification(ctx.service, {
        userId: ticket.user_id,
        category: 'support_resolved',
        severity: 'success',
        dedupeKey: `ticket:${id}:resolved`,
        ...renderServerCopy(await getUserDictionary(ctx.service, ticket.user_id), { kind: 'support_resolved', subject: ticket.subject, number: ticket.number }),
        metadata: { ticketNumber: ticket.number },
        push: { data: { kind: 'support_resolved', ticketNumber: String(ticket.number) } },
      })
    }
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
    // A hard delete leaves no copy: the audit row keeps what was lost (no body text, no address).
    const { count } = await ctx.service.from('support_ticket_messages').select('id', { count: 'exact', head: true }).eq('ticket_id', id)
    await ctx.service.from('support_tickets').delete().eq('id', id)
    await ctx.audit('support.ticket_delete', {
      ...target,
      summary: `Deleted ticket #${ticket.number}`,
      metadata: { number: ticket.number, subject: ticket.subject, status: ticket.status, priority: ticket.priority, category: ticket.category, createdAt: ticket.created_at, hadUser: !!ticket.user_id, messages: count ?? 0 },
    })
    return json({ ok: true })
  }

  return bad('Unknown action.')
}
