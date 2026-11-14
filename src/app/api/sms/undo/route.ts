/**
 * POST /api/sms/undo
 *
 * Forgets an SMS message: the database function sms_discard_message retires everything the message wrote and puts
 * its paired sibling back as an independent message (migration 0273). The same function runs when the app deletes
 * one of the message's rows. Auth: Bearer (Supabase JWT or SMS ingest token, same resolver as sms/ack) or the
 * session cookie (web).
 *
 * Only the funnel's `sms_parse_log` rows exist, so `parseLogId` is the sole input.
 */

import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { smsDeviceGate } from '@/lib/sms/deviceGate'

const bodySchema = z.object({
  parseLogId: z.string().uuid(),
})

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const serviceClient = createServiceRoleClient()
  const hasBearer = (request.headers.get('authorization') ?? '').startsWith('Bearer ')
  const caller = hasBearer
    ? await resolveSmsCaller(request)
    : { userId: await resolveActiveApiUserId(request), deviceId: null, viaJwt: false }
  const { userId } = caller

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = await smsDeviceGate(serviceClient, caller)
  if (blocked) return blocked

  // ── Parse body ───────────────────────────────────────────────────────────
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { parseLogId } = parsed.data

  const { data: logRow, error: logErr } = await serviceClient
    .from('sms_parse_log')
    .select('user_id')
    .eq('id', parseLogId)
    .single()

  if (logErr || !logRow) {
    return NextResponse.json({ error: 'Parse log not found' }, { status: 404 })
  }
  if (logRow.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await serviceClient.rpc('sms_discard_message', {
    p_user_id: userId,
    p_log_id: parseLogId,
  })
  if (error) {
    console.error('[sms/undo] discard error', error.message)
    return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
  }
  if ((data as { nothing_to_do?: boolean } | null)?.nothing_to_do) {
    return NextResponse.json({ ok: true, alreadyUndone: true })
  }
  return NextResponse.json({ ok: true, expired: false })
}
