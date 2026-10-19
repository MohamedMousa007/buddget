import { guardAdmin, json } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'overview.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx

  const [overview, signups, activity, sms, adoption] = await Promise.all([
    service.rpc('admin_overview'),
    service.rpc('admin_signup_series', { p_days: 30 }),
    service.rpc('admin_activity_series', { p_days: 30 }),
    service.rpc('admin_sms_health', { p_days: 7 }),
    service.rpc('admin_feature_adoption'),
  ])
  const failed = [overview, signups, activity, sms, adoption].find((r) => r.error)
  if (failed?.error) {
    console.error('[admin/overview] rpc failed', failed.error.message)
    return json({ error: 'Could not load the overview.' }, 500)
  }
  return json({
    overview: overview.data,
    signups: signups.data,
    activity: activity.data,
    sms: sms.data,
    adoption: adoption.data,
    generatedAt: new Date().toISOString(),
  })
}
