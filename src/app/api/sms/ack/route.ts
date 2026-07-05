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
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'

const bodySchema = z.object({ logId: z.string().uuid() })

async function resolveUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!bearer) return null
  const service = createServiceRoleClient()

  const { data: jwtUser } = await service.auth.getUser(bearer)
  if (jwtUser?.user) return jwtUser.user.id

  const { data: tokenRow } = await service
    .from('sms_ingest_tokens')
    .select('user_id')
    .eq('token', bearer)
    .eq('is_active', true)
    .single()

  return tokenRow?.user_id ?? null
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let json: unknown
  try { json = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const service = createServiceRoleClient()
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
