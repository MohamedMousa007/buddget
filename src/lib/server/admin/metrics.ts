import { after } from 'next/server'
import type { ServiceClient } from '@/lib/supabase/service'

/** The heavy admin aggregates are computed when an admin opens a page and the cache is older than 15 minutes (no schedule), into `admin_metrics_cache`. */
export const METRIC_KEYS = ['overview', 'feature_adoption', 'sms_health_7', 'retention_10', 'signup_series_30', 'activity_series_30', 'funnel_30', 'retention_days'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** A refresh is requested when the cache is older than this; one caller at a time refreshes (database advisory lock). */
export const METRIC_REFRESH_AFTER_MS = 15 * 60 * 1000
/** A cached value is still served this long while another admin's refresh is in flight; older ones are computed live. */
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

/** Cached values: stale ones are served at once and refreshed after the response; only a missing or ancient value waits for the refresh or is computed live. */
export async function adminMetrics(service: ServiceClient, keys: readonly MetricKey[], now = Date.now()): Promise<Record<MetricKey, unknown>> {
  const read = async () => (await service.from('admin_metrics_cache').select('key, value, computed_at').in('key', [...keys])).data ?? []
  let data = await read()
  const ageOf = (k: MetricKey) => {
    const row = data.find((r) => r.key === k)
    return row ? now - new Date(row.computed_at).getTime() : Infinity
  }
  const refresh = () => service.rpc('admin_refresh_metrics_if_stale', { p_max_age: '15 minutes' })
  if (keys.some((k) => ageOf(k) >= METRIC_MAX_AGE_MS)) {
    const { data: refreshed } = await refresh()
    if (refreshed) data = await read()
  } else if (keys.some((k) => ageOf(k) >= METRIC_REFRESH_AFTER_MS)) {
    after(async () => {
      await refresh()
    })
  }
  const fresh = new Map<string, unknown>()
  for (const row of data) if (now - new Date(row.computed_at).getTime() < METRIC_MAX_AGE_MS) fresh.set(row.key, row.value)

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
