import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/server/clientIp'
import { STALE_CACHE_SECONDS, ageSeconds, buildInfo } from '@/lib/health/buildInfo'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { CRON_LAST_RUN_KEY, evaluateCronHealth } from '@/lib/server/cronHealth'

export const dynamic = 'force-dynamic'

const PER_MINUTE = 30

/**
 * Readiness for a monitor and the portal: one cheap database read, the metrics cache, the last notification cron run and the integration outbox.
 * `degraded` means the app is up but a background job is not (missing CRON_SECRET, stale cron, dead outbox rows).
 * Rate limited per caller address so it cannot be used to load the database. Reports status only, never data.
 */
export async function GET(request: Request) {
  const started = Date.now()
  const service = createServiceRoleClient()
  // The platform sets x-real-ip itself; the first x-forwarded-for hop is client-supplied and would let a caller pick its own bucket.
  const caller = clientIp(request)

  const { data: allowed, error: rateErr } = await service.rpc('api_rate_hit', { p_key: `health:${caller}`, p_window_seconds: 60, p_max_hits: PER_MINUTE })
  if (rateErr) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (allowed === false) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } })

  const [db, cache, lastRun, outboxPending, outboxDead, outboxOldest] = await Promise.all([
    service.from('platform_settings').select('key').limit(1),
    service.from('admin_metrics_cache').select('computed_at').order('computed_at', { ascending: false }).limit(1),
    service.from('platform_settings').select('value').eq('key', CRON_LAST_RUN_KEY).maybeSingle(),
    service.from('integration_outbox').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed']),
    service.from('integration_outbox').select('id', { count: 'exact', head: true }).eq('status', 'dead'),
    service.from('integration_outbox').select('created_at').in('status', ['pending', 'failed']).order('created_at', { ascending: true }).limit(1),
  ])
  const cronHealth = evaluateCronHealth({
    secretSet: Boolean(process.env.CRON_SECRET),
    lastRunAt: (lastRun.data?.value as { at?: string } | null)?.at ?? null,
    nowMs: Date.now(),
    outbox: outboxPending.error || outboxDead.error ? null : { pending: outboxPending.count ?? 0, dead: outboxDead.count ?? 0, oldestPendingAt: outboxOldest.data?.[0]?.created_at ?? null },
  })
  const dbOk = !db.error
  const cacheAge = ageSeconds(cache.data?.[0]?.computed_at, Date.now())
  const cacheOk = !cache.error && (cacheAge === null || cacheAge < STALE_CACHE_SECONDS)
  const ok = dbOk && cacheOk

  return NextResponse.json(
    { ok, ...buildInfo(), checks: { database: dbOk, metricsCache: cacheOk, metricsCacheAgeSeconds: cacheAge }, cron: cronHealth, degraded: ok && !cronHealth.ok, latencyMs: Date.now() - started },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
