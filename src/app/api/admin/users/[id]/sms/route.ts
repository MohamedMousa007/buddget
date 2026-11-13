import { bad, guardAdmin, json } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

const WINDOW_DAYS = 30
const ROW_CAP = 2000

/**
 * One user's SMS health: what each phone still holds undelivered, and how their last 30 days of messages ended.
 * No message content, amounts or merchants: those stay behind the financial grant in the log panel.
 */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()

  const [devices, log, settings] = await Promise.all([
    service.from('user_devices')
      .select('device_id, name, platform, model, app_version, collects_sms, is_main, last_seen_at, last_sms_at, revoked_at, sms_queue_pending, sms_queue_oldest_at, sms_last_result, sms_queue_reported_at, sms_evicted_count')
      .eq('user_id', id).order('last_seen_at', { ascending: false }),
    service.from('sms_parse_log').select('status, failure_code, received_at').eq('user_id', id).gte('received_at', since).order('received_at', { ascending: false }).limit(ROW_CAP),
    service.from('user_settings').select('sms_tracking_enabled').eq('user_id', id).maybeSingle(),
  ])
  if (devices.error || log.error) return bad('Could not load SMS health.', 500)

  const counts: Record<string, number> = {}
  for (const r of log.data ?? []) {
    const key = r.status === 'failed' || r.status === 'rejected' ? `${r.status}:${r.failure_code ?? 'unknown'}` : r.status
    counts[key] = (counts[key] ?? 0) + 1
  }
  return json({
    trackingEnabled: Boolean(settings.data?.sms_tracking_enabled),
    windowDays: WINDOW_DAYS,
    total: log.data?.length ?? 0,
    lastReceivedAt: log.data?.[0]?.received_at ?? null,
    counts,
    devices: devices.data ?? [],
  })
}
