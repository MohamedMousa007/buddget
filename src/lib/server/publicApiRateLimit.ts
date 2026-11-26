import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

const WINDOW_SECONDS = 60
const MAX_HITS = 240
const SHARED_CHECK_AFTER = MAX_HITS / 2
const MAX_TRACKED_IPS = 10000
const hits = new Map<string, number[]>()

/** Per-isolate fallback, used only when the shared limiter is unreachable. */
export function memoryRateLimitOk(ip: string, now = Date.now()): boolean {
  const windowStart = now - WINDOW_SECONDS * 1000
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [trackedIp, times] of hits.entries()) {
      if (times.length === 0) hits.delete(trackedIp)
    }
  }
  return recent.length <= MAX_HITS
}

export function resetMemoryRateLimit(): void {
  hits.clear()
}

function recentHits(ip: string): number {
  return hits.get(ip)?.length ?? 0
}

/**
 * In-memory limiter first; the shared `api_rate_hit` RPC is only consulted once an IP passes half
 * the per-isolate allowance, so normal traffic never writes to the DB. RPC errors fall back to memory.
 */
export async function publicApiRateLimitOk(ip: string): Promise<boolean> {
  if (!memoryRateLimitOk(ip)) return false
  if (recentHits(ip) <= SHARED_CHECK_AFTER) return true
  try {
    const { data, error } = await createServiceRoleClient().rpc('api_rate_hit', {
      p_key: `public-api:${ip}`,
      p_window_seconds: WINDOW_SECONDS,
      p_max_hits: MAX_HITS,
    })
    if (!error && typeof data === 'boolean') return data
  } catch {
    // Missing env or network failure: the in-memory verdict above stands.
  }
  return true
}

const scopedHits = new Map<string, number[]>()

/**
 * Per-isolate pre-gate for unauthenticated hot routes: a burst from one key is refused here, before any database counter.
 * `windowSeconds` is also the value to send as `Retry-After`.
 */
export function memoryGateOk(key: string, maxHits: number, windowSeconds = WINDOW_SECONDS, now = Date.now()): boolean {
  const windowStart = now - windowSeconds * 1000
  const recent = (scopedHits.get(key) ?? []).filter((t) => t > windowStart)
  const allowed = recent.length < maxHits
  if (allowed) recent.push(now)
  scopedHits.set(key, recent)
  if (scopedHits.size > MAX_TRACKED_IPS) {
    for (const [trackedKey, times] of scopedHits.entries()) {
      if (times[times.length - 1]! <= windowStart) scopedHits.delete(trackedKey)
    }
  }
  return allowed
}

export function resetMemoryGate(): void {
  scopedHits.clear()
}

export function tooManyRequests(windowSeconds = WINDOW_SECONDS): NextResponse {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(windowSeconds) } })
}
