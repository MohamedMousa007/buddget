import { guardAdmin, json } from '@/lib/server/admin/guard'
import { adminMetrics } from '@/lib/server/admin/metrics'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'analytics.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 30, 7), 180)

  try {
    const m = await adminMetrics(service, ['overview', 'feature_adoption', 'retention_10', 'signup_series_30', 'activity_series_30'])
    // The cached series cover 30 days; other windows are cheap to compute (they read the daily rollup).
    const [signups, activity] =
      days === 30
        ? [m.signup_series_30, m.activity_series_30]
        : await Promise.all([service.rpc('admin_signup_series', { p_days: days }), service.rpc('admin_activity_series', { p_days: days })]).then(([s, a]) => {
            if (s.error || a.error) throw new Error((s.error ?? a.error)!.message)
            return [s.data, a.data]
          })
    return json({ days, signups, activity, adoption: m.feature_adoption, retention: m.retention_10, overview: m.overview })
  } catch (e) {
    console.error('[admin/analytics] failed', e instanceof Error ? e.message : e)
    return json({ error: 'Could not load analytics.' }, 500)
  }
}
