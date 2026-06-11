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

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!bearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const { data: tokenRow } = await service
    .from('sms_ingest_tokens')
    .select('user_id')
    .eq('token', bearer)
    .eq('is_active', true)
    .single()

  if (!tokenRow) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
