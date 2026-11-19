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

const RETRY_DELAYS_MS = [2_000, 6_000, 15_000]

/** Backoff before re-flushing a failed diff; null once the bounded retries are spent. */
export function flushRetryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null
}
