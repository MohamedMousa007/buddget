import type { SupabaseClient } from '@supabase/supabase-js'

export type RateLimitOutcome = 'ok' | 'limited' | 'error'

/** Shared Postgres counter (`api_rate_hit`), telling a real limit apart from a counter outage. */
export async function rateLimitOutcome(service: SupabaseClient, key: string, windowSeconds: number, maxHits: number): Promise<RateLimitOutcome> {
  const { data, error } = await service.rpc('api_rate_hit', { p_key: key, p_window_seconds: windowSeconds, p_max_hits: maxHits })
  if (error) {
    console.error('[rateLimit] rpc failed', key.split(':')[0], error.message)
    return 'error'
  }
  return data === false ? 'limited' : 'ok'
}

/** An RPC error counts as limited unless `failOpen`, for routes that must not lock users out on a DB blip. */
export async function isRateLimited(service: SupabaseClient, key: string, windowSeconds: number, maxHits: number, failOpen = false): Promise<boolean> {
  const outcome = await rateLimitOutcome(service, key, windowSeconds, maxHits)
  return outcome === 'limited' || (outcome === 'error' && !failOpen)
}
