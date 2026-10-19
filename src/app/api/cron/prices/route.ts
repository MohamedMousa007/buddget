/**
 * GET /api/cron/prices  (Vercel Cron)
 *
 * Refreshes the shared asset_prices cache via {@link runPriceRefresh}: global gold spot, Egyptian
 * karat prices (consensus Sagha dollar crawled from keyless sources), crypto, Gulf karats, held
 * stocks. Clients read this table; they never call providers themselves (free-tier limits, F8).
 * Every write is an upsert on (symbol, currency), so running repeatedly is safe.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { runPriceRefresh } from '@/lib/prices/runPriceRefresh'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

/** Admin analytics reads at most 90 days; keep a margin and drop the rest so the table stays small. */
const ANALYTICS_RETENTION_DAYS = 120

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPriceRefresh()
  const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 86_400_000).toISOString()
  const { error: pruneError } = await createServiceRoleClient().from('app_analytics_events').delete().lt('created_at', cutoff)
  if (pruneError) console.error('[cron/prices] analytics retention failed', pruneError)
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { error: reservationError } = await createServiceRoleClient().from('ai_reservations').delete().lt('created_at', week).or(`settled.eq.true,expires_at.lt.${new Date().toISOString()}`)
  if (reservationError) console.error('[cron/prices] reservation cleanup failed', reservationError)
  const status = result.error ? 500 : 200
  return NextResponse.json(result, { status })
}
