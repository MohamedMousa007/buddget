import { emptySnapshot, type Snapshot } from '@/lib/supabase/remote'
import { holdParkedBack } from '@/lib/supabase/remote/parkedRows'
import type { ParkedRow } from '@/lib/supabase/remote/sync'

/**
 * A failed flush keeps the old baseline so the next flush re-sends the same diff instead of dropping it. Rows the
 * server set aside in that flush stay out of the new baseline too, so they are offered again and never count as delivered.
 */
export function baselineAfterFlush(previous: Snapshot | null, current: Snapshot, flushed: boolean, parked: readonly ParkedRow[] = []): Snapshot | null {
  if (!flushed) return previous
  return parked.length > 0 ? holdParkedBack(current, previous ?? emptySnapshot(), parked) : current
}

const RETRY_DELAYS_MS = [2_000, 6_000, 15_000, 30_000, 60_000]

/**
 * Backoff before re-flushing a failed diff. D-4: it never gives up while the app is open and online; after the ramp it
 * retries once a minute, so a late failure in a long session still lands without waiting for the next edit.
 */
export function flushRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
}
