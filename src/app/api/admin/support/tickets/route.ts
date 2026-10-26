import { readValidated, ticketCreateBody } from '@/lib/server/admin/bodySchemas'
import { bad, guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

const STATUSES = ['open', 'pending', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const CATEGORIES = ['general', 'bug', 'sms', 'sync', 'billing', 'account', 'feature', 'other']

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const url = new URL(req.url)
  const view = url.searchParams.get('view') ?? 'active'
  const assignee = url.searchParams.get('assignee')
  const priority = url.searchParams.get('priority')
  const search = url.searchParams.get('q')?.trim()

  let q = ctx.service
    .from('support_tickets')
    .select('id, number, user_id, requester_email, subject, category, priority, status, assignee_id, source, tags, kind, severity, triage_state, linear_issue_url, sla_first_response_due, created_at, updated_at, first_response_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (view === 'active') q = q.in('status', ['open', 'pending'])
  else if (view === 'mine') q = q.in('status', ['open', 'pending']).eq('assignee_id', ctx.staff.id)
  else if (view === 'unassigned') q = q.in('status', ['open', 'pending']).is('assignee_id', null)
  else if (view === 'triage') q = q.in('status', ['open', 'pending']).eq('triage_state', 'needs_human')
  else if (STATUSES.includes(view)) q = q.eq('status', view)
  if (assignee && UUID_RE.test(assignee)) q = q.eq('assignee_id', assignee)
  if (priority && PRIORITIES.includes(priority)) q = q.eq('priority', priority)
  if (search) q = q.or(`subject.ilike.%${search.replace(/[%,()]/g, '')}%,requester_email.ilike.%${search.replace(/[%,()]/g, '')}%`)

  const [tickets, staff, counts] = await Promise.all([
    q,
    ctx.service.from('admin_staff').select('id, display_name, email').eq('status', 'active'),
    ctx.service.rpc('admin_ticket_counts'),
  ])
  if (tickets.error) return bad('Could not load tickets.', 500)

  const rows = counts.data ?? []
  const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((a, r) => a + r.n, 0)
  const isOpen = (r: (typeof rows)[number]) => r.status === 'open' || r.status === 'pending'
  return json({
    tickets: (tickets.data ?? []).map((t) => ({ ...t, requester_email: maskIf(ctx, t.requester_email) })),
    staff: (staff.data ?? []).map((s) => ({ id: s.id, name: s.display_name ?? s.email })),
    counts: {
      active: sum(isOpen),
      mine: sum((r) => isOpen(r) && r.assignee_id === ctx.staff.id),
      unassigned: sum((r) => isOpen(r) && !r.assignee_id),
      urgent: sum((r) => isOpen(r) && r.priority === 'urgent'),
      resolved: sum((r) => r.status === 'resolved'),
    },
    me: ctx.staff.id,
  })
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.reply' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readValidated(req, ticketCreateBody)
  const subject = body?.subject?.trim()
  const message = body?.message?.trim()
  if (!subject || subject.length < 3) return bad('Give the ticket a subject.')
  if (!message) return bad('Describe the issue.')

  let userId: string | null = null
  let email = body?.email?.trim() || null
  if (body?.userId) {
    if (!UUID_RE.test(body.userId)) return bad('Invalid user.')
    const { data: u } = await ctx.service.auth.admin.getUserById(body.userId)
    if (!u.user) return bad('User not found.', 404)
    userId = u.user.id
    email = u.user.email ?? email
  }

  const { data: ticket, error } = await ctx.service
    .from('support_tickets')
    .insert({
      user_id: userId,
      requester_email: email,
      subject: subject.slice(0, 200),
      category: (CATEGORIES.includes(body?.category ?? '') ? body!.category! : 'general') as 'general',
      priority: (PRIORITIES.includes(body?.priority ?? '') ? body!.priority! : 'normal') as 'normal',
      source: 'admin',
      assignee_id: ctx.staff.id,
    })
    .select('id, number')
    .single()
  if (error || !ticket) return bad('Could not create the ticket.', 500)
  await ctx.service.from('support_ticket_messages').insert({ ticket_id: ticket.id, author_type: 'staff', author_staff_id: ctx.staff.id, author_label: ctx.staff.display_name ?? ctx.staff.email, body: message.slice(0, 10000), internal: true })
  await ctx.audit('support.ticket_create', { targetType: 'ticket', targetId: ticket.id, summary: `Created ticket #${ticket.number}` })
  return json({ ok: true, id: ticket.id, number: ticket.number })
}
