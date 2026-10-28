/**
 * POST /api/prices/refresh  (lazy self-heal, no auth)
 *
 * Clients call this on opening Savings/Investment when the cache looks stale, so prices recover
 * even when the scheduled cron isn't firing in production. Safe to expose without the cron secret:
 * it is **debounced on the last attempt** (shared across instances through the database), so a burst of
 * callers can't stampede the upstream providers — and an in-process inflight lock
 * dedupes concurrent calls within a single serverless instance. The heavy compute + service-role
 * write live in the shared {@link runPriceRefresh}; every write is idempotent.
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { claimPriceRefresh } from '@/lib/prices/claimPriceRefresh'
import { runPriceRefresh } from '@/lib/prices/runPriceRefresh'

export const maxDuration = 60

// At most one attempt per hour, however many clients ask.
const DEBOUNCE_MS = 60 * 60 * 1000 // 1h

// ponytail: per-instance inflight lock; the DB debounce is the real stampede guard across instances.
let inflight: Promise<{ ok: boolean; written: number; reason?: string; error?: string }> | null = null

export async function POST() {
  try {
    const service = createServiceRoleClient()
    // Debounce on the last ATTEMPT (kept in platform_settings), not on the oldest row: a symbol nobody can update any
    // more would keep the oldest row stale for ever and let every caller re-run the whole provider crawl.
    if (!(await claimPriceRefresh(service, Date.now(), DEBOUNCE_MS))) {
      return NextResponse.json({ ok: true, skipped: 'recent_attempt', written: 0 })
    }

    if (!inflight) {
      inflight = runPriceRefresh().finally(() => { inflight = null })
    }
    const result = await inflight
    if (result.error) {
      console.error('[prices/refresh] failed', result.error)
      return NextResponse.json({ ok: false, error: 'refresh failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: result.ok, written: result.written, reason: result.reason })
  } catch (e) {
    console.error('[prices/refresh] unexpected', e)
    return NextResponse.json({ ok: false, error: 'refresh failed' }, { status: 500 })
  }
}
