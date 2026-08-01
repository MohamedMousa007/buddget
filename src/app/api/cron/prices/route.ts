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

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPriceRefresh()
  const status = result.error ? 500 : 200
  return NextResponse.json(result, { status })
}
