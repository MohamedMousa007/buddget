import { guardAdmin, json } from '@/lib/server/admin/guard'
import { adminMetrics } from '@/lib/server/admin/metrics'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'overview.view' })
  if (!g.ok) return g.res
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const [m, alerts] = await Promise.all([
      adminMetrics(g.ctx.service, ['overview', 'signup_series_30', 'activity_series_30', 'sms_health_7', 'feature_adoption']),
      // Written by the daily ai-chat-error-check job (migration 0342); a failed read only hides the line, never the page.
      g.ctx.service.from('ai_model_alerts').select('alert_date, model, calls, errors, empties, failed_share, rule').gte('alert_date', since).order('alert_date', { ascending: false }).limit(50),
    ])
    if (alerts.error) console.error('[admin/overview] ai_model_alerts read failed', alerts.error.message)
    return json({ overview: m.overview, signups: m.signup_series_30, activity: m.activity_series_30, sms: m.sms_health_7, adoption: m.feature_adoption, aiAlerts: alerts.data ?? [], generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[admin/overview] metrics failed', e instanceof Error ? e.message : e)
    return json({ error: 'Could not load the overview.' }, 500)
  }
}
