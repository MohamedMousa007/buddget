/**
 * POST /api/sms/dismiss
 *
 * Clears `awaiting_confirmation` on one of the caller's own sms_parse_log rows (the review sheet's Dismiss). The table is
 * read-only for clients since migration 0231, so the write goes through the service role with the owner in the filter.
 *
 * Auth: Supabase session cookie (web) or Bearer JWT (native via apiFetchAuth).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { smsDeviceGate } from '@/lib/sms/deviceGate'
import { createServiceRoleClient } from '@/lib/supabase/service'

const bodySchema = z.object({ logId: z.string().uuid() })

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()
  const blocked = await smsDeviceGate(service, {
    userId,
    deviceId: request.headers.get(DEVICE_ID_HEADER)?.trim() || null,
    viaJwt: (request.headers.get('authorization') ?? '').startsWith('Bearer '),
  })
  if (blocked) return blocked

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Provide logId' }, { status: 400 })

  const { data, error } = await service
    .from('sms_parse_log')
    .update({ awaiting_confirmation: false })
    .eq('user_id', userId)
    .eq('id', parsed.data.logId)
    .eq('awaiting_confirmation', true)
    .select('id')
  if (error) {
    console.error('[sms/dismiss] update failed', error.message)
    return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
