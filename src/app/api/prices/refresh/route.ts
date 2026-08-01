/**
 * POST /api/prices/refresh  (lazy self-heal, no auth)
 *
 * Clients call this on opening Savings/Investment when the cache looks stale, so prices recover
 * even when the scheduled cron isn't firing in production. Safe to expose without the cron secret:
 * it is **globally debounced** — if the table's newest row is younger than DEBOUNCE_MS it no-ops,
 * so a burst of callers can't stampede the upstream providers — and an in-process inflight lock
 * dedupes concurrent calls within a single serverless instance. The heavy compute + service-role
 * write live in the shared {@link runPriceRefresh}; every write is idempotent.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { runPriceRefresh } from '@/lib/prices/runPriceRefresh'

export const maxDuration = 60

// Only actually refresh if the freshest row is older than this. Matches the tightest freshness
// window (gold/crypto 6h) so a stale-out triggers exactly one recompute, not one per open.
const DEBOUNCE_MS = 60 * 60 * 1000 // 1h

// ponytail: per-instance inflight lock; the DB debounce is the real stampede guard across instances.
let inflight: Promise<{ ok: boolean; written: number; reason?: string; error?: string }> | null = null

export async function POST() {
  try {
    const service = createServiceRoleClient()
    const { data } = await service
      .from('asset_prices')
      .select('as_of')
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newest = data?.as_of ? Date.parse(data.as_of as string) : 0
    if (newest && Date.now() - newest < DEBOUNCE_MS) {
      return NextResponse.json({ ok: true, skipped: 'fresh', written: 0 })
    }

    if (!inflight) {
      inflight = runPriceRefresh().finally(() => { inflight = null })
    }
    const result = await inflight
    return NextResponse.json(result, { status: result.error ? 500 : 200 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'refresh failed' }, { status: 500 })
  }
}
