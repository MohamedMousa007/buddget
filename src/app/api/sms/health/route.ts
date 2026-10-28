/**
 * GET /api/sms/health
 *
 * One-tap setup check for the iOS Shortcuts bridge. The native plugin calls
 * this through the exact code path CatchBankSmsIntent uses (stored ingest
 * token + URLSession), so a 200 here proves token validity + reachability
 * without sending any SMS. No DB writes.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { smsDeviceGate } from '@/lib/sms/deviceGate'

export async function GET(request: Request) {
  const caller = await resolveSmsCaller(request)
  if (!caller.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = await smsDeviceGate(createServiceRoleClient(), caller)
  if (blocked) return blocked
  return NextResponse.json({ ok: true })
}
