/**
 * POST /api/sms/ack
 *
 * Client acknowledgement that an SMS-tracked expense/income actually rendered in
 * the app (via realtime sync or a tapped push). This is the ONLY signal that
 * promotes a parse log row to status='confirmed' — the true end-to-end success
 * marker. Server-side insertion alone only reaches 'logged'/'notified'.
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
  // Only promote rows that are logged/notified — never overwrite rejected/failed,
  // and scope to the owner so one user can't confirm another's row.
  const { error } = await service
    .from('sms_parse_log')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), parsed_ok: true })
    .eq('id', parsed.data.logId)
    .eq('user_id', userId)
    .in('status', ['logged', 'notified'])

  if (error) {
    console.error('[sms/ack] update failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
