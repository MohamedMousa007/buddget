import type { ServiceClient } from '@/lib/supabase/service'

/** The heavy admin aggregates are computed on a schedule (pg_cron, every 15 min) into `admin_metrics_cache`. */
export const METRIC_KEYS = ['overview', 'feature_adoption', 'sms_health_7', 'retention_10', 'signup_series_30', 'activity_series_30', 'funnel_30', 'retention_days'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** A cached value is trusted for this long; the schedule refreshes it three times as often. */
export const METRIC_MAX_AGE_MS = 45 * 60 * 1000

async function live(service: ServiceClient, key: MetricKey): Promise<{ data: unknown; error: { message: string } | null }> {
  switch (key) {
    case 'overview': return service.rpc('admin_overview')
    case 'feature_adoption': return service.rpc('admin_feature_adoption')
    case 'sms_health_7': return service.rpc('admin_sms_health', { p_days: 7 })
    case 'retention_10': return service.rpc('admin_retention', { p_weeks: 10 })
    case 'signup_series_30': return service.rpc('admin_signup_series', { p_days: 30 })
    case 'activity_series_30': return service.rpc('admin_activity_series', { p_days: 30 })
    case 'funnel_30': return service.rpc('admin_funnel', { p_days: 30 })
    case 'retention_days': return service.rpc('admin_retention_days', { p_signup_days: 90 })
  }
}

/** Fresh cached values, falling back to computing live for anything missing or stale (never wrong, only slower). */
export async function adminMetrics(service: ServiceClient, keys: readonly MetricKey[], now = Date.now()): Promise<Record<MetricKey, unknown>> {
  const { data } = await service.from('admin_metrics_cache').select('key, value, computed_at').in('key', [...keys])
  const fresh = new Map<string, unknown>()
  for (const row of data ?? []) if (now - new Date(row.computed_at).getTime() < METRIC_MAX_AGE_MS) fresh.set(row.key, row.value)

  const out = {} as Record<MetricKey, unknown>
  await Promise.all(
    keys.map(async (key) => {
      if (fresh.has(key)) {
        out[key] = fresh.get(key)
        return
      }
      const r = await live(service, key)
      if (r.error) throw new Error(`${key}: ${r.error.message}`)
      out[key] = r.data
    }),
  )
  return out
}
