import { guardAdmin, json } from '@/lib/server/admin/guard'
import { adminMetrics } from '@/lib/server/admin/metrics'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'overview.view' })
  if (!g.ok) return g.res
  try {
    const m = await adminMetrics(g.ctx.service, ['overview', 'signup_series_30', 'activity_series_30', 'sms_health_7', 'feature_adoption'])
    return json({ overview: m.overview, signups: m.signup_series_30, activity: m.activity_series_30, sms: m.sms_health_7, adoption: m.feature_adoption, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[admin/overview] metrics failed', e instanceof Error ? e.message : e)
    return json({ error: 'Could not load the overview.' }, 500)
  }
}
