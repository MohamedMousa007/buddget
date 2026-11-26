import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isUnreadForUser, userFacingStatus } from '@/lib/support/conversation'

/** The signed-in user's own conversations, latest message first, each with its unread flag and a short preview. */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await createServiceRoleClient()
    .from('support_tickets')
    .select('number, subject, status, kind, created_at, updated_at, first_response_at, last_message_at, last_message_from, last_message_preview, user_last_read_at')
    .eq('user_id', uid)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: 'Could not load your requests' }, { status: 500 })
  const tickets = (data ?? []).map(({ user_last_read_at, ...t }) => {
    const state = { ...t, user_last_read_at }
    return { ...t, unread: isUnreadForUser(state), display_status: userFacingStatus(state) }
  })
  return NextResponse.json({ tickets, unread: tickets.filter((t) => t.unread).length }, { headers: { 'Cache-Control': 'private, no-store' } })
}
