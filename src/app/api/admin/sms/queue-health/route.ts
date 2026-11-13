import { guardAdmin, json, bad, maskIf } from '@/lib/server/admin/guard'
import { canaryState, watchFindings, type CanaryResult, type WatchDevice } from '@/lib/sms/queueWatch'

const MAX_FINDINGS = 100

/** Phones holding undelivered SMS for a day, phones that evicted messages, phones gone quiet, and the daily canary's verdict. */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { service } = g.ctx

  const [devices, canary] = await Promise.all([
    service.from('user_devices')
      .select('user_id, device_id, platform, name, collects_sms, last_seen_at, last_sms_at, sms_queue_pending, sms_queue_oldest_at, sms_last_result, sms_evicted_count')
      .is('revoked_at', null)
      .or('sms_queue_pending.gt.0,sms_evicted_count.gt.0,collects_sms.eq.true')
      .limit(5000),
    service.from('platform_settings').select('value').eq('key', 'sms_canary').maybeSingle(),
  ])
  if (devices.error) return bad('Could not load queue health.', 500)

  const findings = watchFindings((devices.data ?? []) as WatchDevice[]).slice(0, MAX_FINDINGS)
  const ids = [...new Set(findings.map((f) => f.userId))]
  const emails = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: profiles } = await service.from('profiles').select('id, email').in('id', ids)
    for (const p of profiles ?? []) emails.set(p.id, p.email)
  }
  const result = (canary.data?.value ?? null) as CanaryResult | null
  return json({
    findings: findings.map((f) => ({ ...f, email: maskIf(g.ctx, emails.get(f.userId)) })),
    canary: { state: canaryState(result), at: result?.at ?? null, checks: result?.checks ?? [] },
  })
}
