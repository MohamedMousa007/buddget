import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** The signed-in user's own requests, newest first. */
export async function GET(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await createServiceRoleClient()
    .from('support_tickets')
    .select('number, subject, status, kind, created_at, updated_at, first_response_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: 'Could not load your requests' }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}
