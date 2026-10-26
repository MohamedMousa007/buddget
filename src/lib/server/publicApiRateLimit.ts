import { createServiceRoleClient } from '@/lib/supabase/service'

const WINDOW_SECONDS = 60
const MAX_HITS = 120
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

/** Shared limiter backed by the `api_rate_hit` RPC; falls back to the in-memory map when the RPC errors. */
export async function publicApiRateLimitOk(ip: string): Promise<boolean> {
  try {
    const { data, error } = await createServiceRoleClient().rpc('api_rate_hit', {
      p_key: `public-api:${ip}`,
      p_window_seconds: WINDOW_SECONDS,
      p_max_hits: MAX_HITS,
    })
    if (!error && typeof data === 'boolean') return data
  } catch {
    // Missing env or network failure: degrade to the per-isolate limiter.
  }
  return memoryRateLimitOk(ip)
}
