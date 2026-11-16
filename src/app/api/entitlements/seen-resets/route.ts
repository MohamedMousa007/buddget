import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** The person has seen the toast for a staff-granted reset; mark theirs as seen so it is not shown again. */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await createServiceRoleClient().rpc('usage_resets_seen', { p_user: uid })
  if (error) console.error('[usage] seen-resets failed', error.message)
  return NextResponse.json({ ok: !error }, { headers: { 'Cache-Control': 'private, no-store' } })
}
