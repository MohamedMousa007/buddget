import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ number: string }> }

const REPLIES_PER_HOUR = 20
const replySchema = z.object({ message: z.string().trim().min(1).max(4000) })

async function ownTicket(uid: string, raw: string) {
  const number = Number(raw)
  if (!Number.isInteger(number) || number <= 0) return null
  const { data } = await createServiceRoleClient()
    .from('support_tickets')
    .select('id, number, subject, status, kind, created_at, updated_at')
    .eq('number', number)
    .eq('user_id', uid)
    .maybeSingle()
  return data
}

/** One of the user's own requests with the public conversation. Internal staff notes are never returned. */
export async function GET(request: Request, { params }: Params) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const ticket = await ownTicket(uid, (await params).number)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: messages } = await createServiceRoleClient()
    .from('support_ticket_messages')
    .select('id, author_type, author_label, body, created_at')
    .eq('ticket_id', ticket.id)
    .eq('internal', false)
    .order('created_at')
    .limit(200)
  const visible = { number: ticket.number, subject: ticket.subject, status: ticket.status, kind: ticket.kind, created_at: ticket.created_at, updated_at: ticket.updated_at }
  return NextResponse.json({ ticket: visible, messages: (messages ?? []).map((m) => ({ ...m, author_label: m.author_type === 'staff' ? 'Buddget support' : 'You' })) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** The user adds to their own request; a resolved or waiting ticket reopens. */
export async function POST(request: Request, { params }: Params) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const ticket = await ownTicket(uid, (await params).number)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = replySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const service = createServiceRoleClient()
  const { data: allowed } = await service.rpc('api_rate_hit', { p_key: `support-reply:${uid}`, p_window_seconds: 3600, p_max_hits: REPLIES_PER_HOUR })
  if (allowed === false) return NextResponse.json({ error: 'Too many messages, try again later' }, { status: 429 })

  await service.from('support_ticket_messages').insert({ ticket_id: ticket.id, author_type: 'user', author_label: 'Customer', body: parsed.data.message })
  if (ticket.status !== 'open') await service.from('support_tickets').update({ status: 'open', resolved_at: null }).eq('id', ticket.id)
  return NextResponse.json({ ok: true })
}
