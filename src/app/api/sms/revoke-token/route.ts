/**
 * POST /api/sms/revoke-token
 *
 * Called by the app on an explicit sign-out (while the session is still valid): retires the ingest tokens of THIS phone so
 * the non-expiring token left in native storage stops working. Scope: the phone named by the device header, or, with no
 * header, only the device-less tokens; it never touches another phone's token. The next sign-in re-arms through
 * `GET /api/sms/setup-token`.
 *
 * Auth: Bearer Supabase JWT (native) or session cookie (web).
 */
import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deviceId = request.headers.get(DEVICE_ID_HEADER)?.trim().slice(0, 100) || null
  let revoke = createServiceRoleClient().from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)
  revoke = deviceId ? revoke.eq('device_id', deviceId) : revoke.is('device_id', null)
  const { error } = await revoke
  if (error) {
    console.error('[sms/revoke-token] failed', error.message)
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
