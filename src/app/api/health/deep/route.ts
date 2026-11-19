import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { ageSeconds, buildInfo } from '@/lib/health/buildInfo'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { CRON_LAST_RUN_KEY, evaluateCronHealth } from '@/lib/server/cronHealth'
import { isAuthorizedCron } from '@/lib/server/cronAuth'

export const dynamic = 'force-dynamic'

/**
 * Readiness for a monitor and the portal: one cheap database read, the metrics cache, the last notification cron run and the integration outbox.
 * `degraded` means the app is up but a background job is not (missing CRON_SECRET, stale cron, dead outbox rows).
 * The whole answer is computed at most once a minute for every caller together (shared data cache), so polling it cannot load the database;
 * uptime monitors that only need "is the app up" should call the light `/api/health`. Reports status only, never data.
 * The public gets `{ ok, degraded }`; the build, checks and cron detail need `Authorization: Bearer ${CRON_SECRET}` (QA-56).
 */
async function readiness() {
  const started = Date.now()
  const service = createServiceRoleClient()
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
  // The metrics cache is refreshed when an admin opens the metrics (no schedule), so an old cache is normal and never makes the app unhealthy.
  const cacheOk = !cache.error
  const ok = dbOk && cacheOk
  return { ok, checks: { database: dbOk, metricsCache: cacheOk, metricsCacheAgeSeconds: cacheAge }, cron: cronHealth, degraded: ok && !cronHealth.ok, latencyMs: Date.now() - started }
}

const cachedReadiness = unstable_cache(readiness, ['health-deep'], { revalidate: 60 })

export async function GET(request: Request) {
  let body: Awaited<ReturnType<typeof readiness>>
  try {
    body = await cachedReadiness()
  } catch {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const answer = isAuthorizedCron(request) ? { ...buildInfo(), ...body } : { ok: body.ok, degraded: body.degraded }
  return NextResponse.json(answer, { status: body.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
