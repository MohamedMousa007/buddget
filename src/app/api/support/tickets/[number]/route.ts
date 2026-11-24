import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { isRateLimited } from '@/lib/server/rateLimit'
import { signThreadAttachments } from '@/lib/server/supportAttachments'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'
import { ownAttachments } from '@/lib/support/attachments'
import { nextReadMark, staffFirstName, userFacingStatus } from '@/lib/support/conversation'

type Params = { params: Promise<{ number: string }> }

const REPLIES_PER_HOUR = 20
const THREAD_LIMIT = 200
const replySchema = z.object({ message: z.string().trim().max(4000).default(''), attachments: z.unknown().optional() })

/** The ticket only when it belongs to the caller; any other number answers as if it did not exist. */
async function ownTicket(uid: string, raw: string) {
  const number = Number(raw)
  if (!Number.isInteger(number) || number <= 0) return null
  const { data } = await createServiceRoleClient()
    .from('support_tickets')
    .select('id, number, subject, status, kind, created_at, updated_at, last_message_at, last_message_from, user_last_read_at, csat_rating')
    .eq('number', number)
    .eq('user_id', uid)
    .maybeSingle()
  return data
}

/**
 * One of the user's own requests with the public conversation. Internal staff notes are never returned, and a teammate
 * shows by first name only. Opening the thread moves the user's read mark to the newest message returned.
 */
export async function GET(request: Request, { params }: Params) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const ticket = await ownTicket(uid, (await params).number)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const service = createServiceRoleClient()
  const { data: rows } = await service
    .from('support_ticket_messages')
    .select('id, author_type, author_label, body, created_at, attachments')
    .eq('ticket_id', ticket.id)
    .eq('internal', false)
    .order('created_at', { ascending: false })
    .limit(THREAD_LIMIT)
  // The newest messages, shown oldest first: a long thread drops its oldest, never the reply the user came for.
  const messages = await signThreadAttachments(service, (rows ?? []).reverse())
  const mark = nextReadMark(ticket.last_message_at ? [...messages, { created_at: ticket.last_message_at }] : messages, ticket.user_last_read_at)
  if (mark) await service.from('support_tickets').update({ user_last_read_at: mark }).eq('id', ticket.id).eq('user_id', uid)
  const visible = {
    number: ticket.number,
    subject: ticket.subject,
    status: ticket.status,
    kind: ticket.kind,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    display_status: userFacingStatus(ticket),
    can_reply: ticket.status !== 'closed',
    can_rate: (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.csat_rating === null,
    csat_rating: ticket.csat_rating,
  }
  return NextResponse.json(
    {
      ticket: visible,
      messages: messages.map((m) => ({ ...m, author_label: m.author_type === 'staff' ? 'buddget support' : 'You', author_name: m.author_type === 'staff' ? staffFirstName(m.author_label) : null })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

/** The user adds to their own request; a resolved or waiting ticket reopens, a closed one stays closed. */
export async function POST(request: Request, { params }: Params) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const ticket = await ownTicket(uid, (await params).number)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = replySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const attachments = ownAttachments(uid, parsed.data.attachments)
  if (!attachments) return NextResponse.json({ error: 'Invalid attachment' }, { status: 400 })
  if (!parsed.data.message && !attachments.length) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  if (ticket.status === 'closed') return NextResponse.json({ error: 'This request is closed' }, { status: 409 })

  const service = createServiceRoleClient()
  if (await isRateLimited(service, `support-reply:${uid}`, 3600, REPLIES_PER_HOUR)) return NextResponse.json({ error: 'Too many messages, try again later' }, { status: 429 })

  const { data: inserted, error } = await service
    .from('support_ticket_messages')
    .insert({ ticket_id: ticket.id, author_type: 'user', author_label: 'Customer', body: parsed.data.message || '📷', attachments: attachments as unknown as Json })
    .select('id, created_at')
    .single()
  if (error) return NextResponse.json({ error: 'Could not send your message' }, { status: 500 })
  if (ticket.status !== 'open') await service.from('support_tickets').update({ status: 'open', resolved_at: null }).eq('id', ticket.id)
  return NextResponse.json({ ok: true, message: inserted ?? null })
}
