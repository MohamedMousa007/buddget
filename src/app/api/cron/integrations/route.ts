/**
 * GET /api/cron/integrations
 * Sends due outbox rows to Linear. Auth: `Authorization: Bearer ${CRON_SECRET}`. Idempotent and safe to overlap.
 */
import { NextResponse } from 'next/server'
import { drainOutbox } from '@/lib/server/integrations/outbox'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sent = await drainOutbox(createServiceRoleClient(), process.env.LINEAR_API_KEY, 20)
  return NextResponse.json({ ok: true, sent })
}
