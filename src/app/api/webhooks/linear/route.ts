import { NextResponse } from 'next/server'
import { freshTimestamp, parseIssueEvent, ticketStatusFor, validSignature } from '@/lib/integrations/linearWebhook'
import { emitNotification } from '@/lib/server/emitNotification'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Linear tells us an issue moved; the matching ticket follows and the user hears when it is resolved. */
export async function POST(request: Request) {
  const secret = process.env.LINEAR_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const raw = await request.text()
  if (!validSignature(raw, request.headers.get('linear-signature'), secret)) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  let body: { webhookTimestamp?: number }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!freshTimestamp(body.webhookTimestamp, Date.now())) return NextResponse.json({ error: 'Stale' }, { status: 400 })

  const event = parseIssueEvent(body)
  const status = event && ticketStatusFor(event.stateType)
  if (!event || !status) return NextResponse.json({ ok: true })

  const service = createServiceRoleClient()
  const { data: ticket } = await service.from('support_tickets').select('id, number, user_id, subject, status').eq('linear_issue_id', event.identifier).maybeSingle()
  if (!ticket || ticket.status === status || ticket.status === 'closed') return NextResponse.json({ ok: true })

  await service.from('support_tickets').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', ticket.id)
  await service.from('support_ticket_messages').insert({ ticket_id: ticket.id, author_type: 'system', author_label: 'Linear', body: `Engineering marked this ${status === 'resolved' ? 'done' : 'in progress'}.`, internal: true })
  if (status === 'resolved' && ticket.user_id) {
    await emitNotification(service, {
      userId: ticket.user_id,
      category: 'support_resolved',
      severity: 'success',
      dedupeKey: `ticket:${ticket.id}:resolved`,
      title: `Fixed: ${ticket.subject}`.slice(0, 80),
      body: `Your request #${ticket.number} has been resolved. Thank you for telling us.`,
      metadata: { ticketNumber: ticket.number },
    })
  }
  return NextResponse.json({ ok: true })
}
