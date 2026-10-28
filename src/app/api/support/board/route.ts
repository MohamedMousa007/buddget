import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** The ideas staff have published, with the signed-in user's own vote. Only staff-written text is returned. */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const service = createServiceRoleClient()
  const { data, error } = await service
    .from('support_tickets')
    .select('id, number, board_title, board_summary, board_state, votes')
    .neq('board_state', 'hidden')
    .order('votes', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Could not load the board' }, { status: 500 })
  const ids = (data ?? []).map((t) => t.id)
  const { data: mine } = ids.length ? await service.from('feedback_votes').select('ticket_id, value').eq('user_id', uid).in('ticket_id', ids) : { data: [] }
  const mineBy = new Map((mine ?? []).map((v) => [v.ticket_id, v.value]))
  const items = (data ?? []).map((t) => ({ number: t.number, title: t.board_title ?? '', summary: t.board_summary ?? '', state: t.board_state, votes: t.votes, mine: mineBy.get(t.id) ?? 0 }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
