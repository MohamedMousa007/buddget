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
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { runPriceRefresh } from '@/lib/prices/runPriceRefresh'
import { harvestLegacySms } from '@/lib/sms/harvest'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runPriceRefresh()
  // Retention and rollups run inside the database (pg_cron). This only sweeps up SMS text that predates the
  // ingest-time harvest, so raw bodies can be removed after 30 days without losing what they taught.
  const harvested = await harvestLegacySms(createServiceRoleClient(), 500).catch((e) => {
    console.error('[cron/prices] sms harvest failed', e instanceof Error ? e.message : e)
    return 0
  })
  if (harvested > 0) console.log('[cron/prices] sms rows harvested', harvested)
  const status = result.error ? 500 : 200
  return NextResponse.json(result, { status })
}

// pg_cron + pg_net calls with POST; Vercel crons call GET. Same handler, same auth.
export const POST = GET
