import type { Snapshot } from '@/lib/supabase/remote'

/** A failed flush keeps the old baseline so the next flush re-sends the same diff instead of dropping it. */
export function baselineAfterFlush(previous: Snapshot | null, current: Snapshot, flushed: boolean): Snapshot | null {
  return flushed ? current : previous
}

const RETRY_DELAYS_MS = [2_000, 6_000, 15_000]

/** Backoff before re-flushing a failed diff; null once the bounded retries are spent. */
export function flushRetryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null
}
