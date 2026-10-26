/**
 * POST /api/sms/ack
 *
 * Client acknowledgement that an SMS-tracked expense/income actually rendered in
 * the app (via realtime sync or a tapped push). An ack means the app has the
 * transaction, which is the success signal → status='confirmed'. Push delivery
 * is recorded separately (pushed_at/push_result) and does not gate confirmation.
 *
 * Auth: Supabase JWT (mobile) or bearer token from `sms_ingest_tokens`.
 * Idempotent: re-acking a confirmed row is a no-op.
 */
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { isRevokedDevice } from '@/lib/server/devices/registry'

const bodySchema = z.object({ logId: z.string().uuid() })

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const { userId, deviceId } = await resolveSmsCaller(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceRoleClient()
  if (await isRevokedDevice(service, userId, deviceId)) {
    return NextResponse.json({ error: 'This phone was removed from the account' }, { status: 403 })
  }

  let json: unknown
  try { json = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Atomic render-ack: → 'confirmed' if a push already delivered, else 'rendered'.
  // Scoped to the owner; never touches rejected/failed/confirmed rows.
  const { error } = await service.rpc('sms_mark_acked', {
    p_log_id: parsed.data.logId,
    p_user_id: userId,
  })

  if (error) {
    console.error('[sms/ack] mark_acked failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
