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
