import { NextResponse } from 'next/server'
import { STALE_CACHE_SECONDS, ageSeconds, buildInfo } from '@/lib/health/buildInfo'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const PER_MINUTE = 30

/**
 * Readiness for a monitor and the portal: one cheap database read and one look at the metrics cache.
 * Rate limited per caller address so it cannot be used to load the database. Reports status only, never data.
 */
export async function GET(request: Request) {
  const started = Date.now()
  const service = createServiceRoleClient()
  const caller = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim().slice(0, 64)

  const { data: allowed, error: rateErr } = await service.rpc('api_rate_hit', { p_key: `health:${caller}`, p_window_seconds: 60, p_max_hits: PER_MINUTE })
  if (rateErr) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (allowed === false) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } })

  const [db, cache] = await Promise.all([
    service.from('platform_settings').select('key').limit(1),
    service.from('admin_metrics_cache').select('computed_at').order('computed_at', { ascending: false }).limit(1),
  ])
  const dbOk = !db.error
  const cacheAge = ageSeconds(cache.data?.[0]?.computed_at, Date.now())
  const cacheOk = !cache.error && (cacheAge === null || cacheAge < STALE_CACHE_SECONDS)
  const ok = dbOk && cacheOk

  return NextResponse.json(
    { ok, ...buildInfo(), checks: { database: dbOk, metricsCache: cacheOk, metricsCacheAgeSeconds: cacheAge }, latencyMs: Date.now() - started },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
