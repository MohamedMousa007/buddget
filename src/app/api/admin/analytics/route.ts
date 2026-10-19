import { guardAdmin, json } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'analytics.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const url = new URL(req.url)
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 7), 180)

  const [signups, activity, adoption, retention, overview] = await Promise.all([
    service.rpc('admin_signup_series', { p_days: days }),
    service.rpc('admin_activity_series', { p_days: days }),
    service.rpc('admin_feature_adoption'),
    service.rpc('admin_retention', { p_weeks: 10 }),
    service.rpc('admin_overview'),
  ])
  const failed = [signups, activity, adoption, retention, overview].find((r) => r.error)
  if (failed?.error) {
    console.error('[admin/analytics] rpc failed', failed.error.message)
    return json({ error: 'Could not load analytics.' }, 500)
  }
  return json({ days, signups: signups.data, activity: activity.data, adoption: adoption.data, retention: retention.data, overview: overview.data })
}
