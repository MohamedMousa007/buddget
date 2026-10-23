import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { drainOutbox } from '@/lib/server/integrations/outbox'
import { createServiceRoleClient } from '@/lib/supabase/service'

const VOTES_PER_HOUR = 60
const LINEAR_VOTE_THRESHOLD = 10
const bodySchema = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })

/** Up (1), down (-1) or take back (0) a vote. One vote per person per idea. */
export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const number = Number((await params).number)
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!Number.isInteger(number) || number <= 0 || !parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const service = createServiceRoleClient()
  const { data: allowed } = await service.rpc('api_rate_hit', { p_key: `board-vote:${uid}`, p_window_seconds: 3600, p_max_hits: VOTES_PER_HOUR })
  if (allowed === false) return NextResponse.json({ error: 'Too many votes, try again later' }, { status: 429 })

  const { data: ticket } = await service.from('support_tickets').select('id').eq('number', number).neq('board_state', 'hidden').maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await service.rpc('cast_feedback_vote', { p_user: uid, p_ticket: ticket.id, p_value: parsed.data.value, p_threshold: LINEAR_VOTE_THRESHOLD })
  const result = data as { votes: number; queued: boolean } | null
  if (error || !result) return NextResponse.json({ error: 'Could not save your vote' }, { status: 500 })
  if (result.queued) after(() => drainOutbox(service, process.env.LINEAR_API_KEY, 1))
  return NextResponse.json({ votes: result.votes, mine: parsed.data.value })
}
