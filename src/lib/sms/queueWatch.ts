/**
 * Staff-facing watch over the on-device SMS queues. A queue that sits for a day, a phone that evicted messages, or a
 * phone that has gone quiet after receiving SMS is a user losing transactions without any error anywhere, so each one
 * is a finding. Pure: the route feeds it rows, the admin panel renders what it returns.
 */
export const STUCK_AFTER_MS = 24 * 3600_000
export const SILENT_AFTER_MS = 7 * 24 * 3600_000
/** The canary runs daily: no result for this long means the canary itself is down. */
export const CANARY_STALE_AFTER_MS = 36 * 3600_000

export interface WatchDevice {
  user_id: string
  device_id: string
  platform: string
  name: string | null
  collects_sms: boolean
  last_seen_at: string
  last_sms_at: string | null
  sms_queue_pending: number
  sms_queue_oldest_at: string | null
  sms_last_result: string | null
  sms_evicted_count: number
}

export type FindingKind = 'evicted' | 'stuck' | 'silent'

export interface WatchFinding {
  kind: FindingKind
  userId: string
  deviceId: string
  platform: string
  name: string | null
  pending: number
  evicted: number
  lastResult: string | null
  /** The timestamp the finding is measured from: oldest queued SMS, or last time the phone was seen. */
  since: string | null
}

const RANK: Record<FindingKind, number> = { evicted: 0, stuck: 1, silent: 2 }
const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN)

export function watchFindings(devices: WatchDevice[], now = Date.now()): WatchFinding[] {
  const out: WatchFinding[] = []
  for (const d of devices) {
    const base = { userId: d.user_id, deviceId: d.device_id, platform: d.platform, name: d.name, pending: d.sms_queue_pending, evicted: d.sms_evicted_count, lastResult: d.sms_last_result }
    if (d.sms_evicted_count > 0) out.push({ ...base, kind: 'evicted', since: d.sms_queue_oldest_at })
    if (d.sms_queue_pending > 0 && now - ms(d.sms_queue_oldest_at) > STUCK_AFTER_MS) out.push({ ...base, kind: 'stuck', since: d.sms_queue_oldest_at })
    if (d.collects_sms && d.last_sms_at && now - ms(d.last_seen_at) > SILENT_AFTER_MS) out.push({ ...base, kind: 'silent', since: d.last_seen_at })
  }
  const age = (f: WatchFinding) => ms(f.since) || now
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || age(a) - age(b))
}

export interface CanaryResult {
  at: string
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail: string }>
}

export type CanaryState = 'ok' | 'failing' | 'stale' | 'unknown'

export function canaryState(result: CanaryResult | null, now = Date.now()): CanaryState {
  if (!result || Number.isNaN(ms(result.at))) return 'unknown'
  if (now - ms(result.at) > CANARY_STALE_AFTER_MS) return 'stale'
  return result.ok ? 'ok' : 'failing'
}
