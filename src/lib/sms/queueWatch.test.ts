import { describe, expect, it } from 'vitest'
import { canaryState, watchFindings, type WatchDevice } from './queueWatch'

const NOW = Date.parse('2026-11-13T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString()
const device = (o: Partial<WatchDevice>): WatchDevice => ({
  user_id: 'u1', device_id: 'd1', platform: 'ios', name: null, collects_sms: true,
  last_seen_at: hoursAgo(1), last_sms_at: hoursAgo(5), sms_queue_pending: 0, sms_queue_oldest_at: null, sms_last_result: null, sms_evicted_count: 0, ...o,
})

describe('watchFindings', () => {
  it('flags a queue whose oldest message is over a day old, not a fresh one', () => {
    expect(watchFindings([device({ sms_queue_pending: 2, sms_queue_oldest_at: hoursAgo(30) })], NOW).map((f) => f.kind)).toEqual(['stuck'])
    expect(watchFindings([device({ sms_queue_pending: 2, sms_queue_oldest_at: hoursAgo(3) })], NOW)).toEqual([])
  })

  it('flags any phone that evicted messages, worst first', () => {
    const out = watchFindings([
      device({ device_id: 'a', sms_queue_pending: 1, sms_queue_oldest_at: hoursAgo(50) }),
      device({ device_id: 'b', sms_evicted_count: 3 }),
    ], NOW)
    expect(out.map((f) => `${f.deviceId}:${f.kind}`)).toEqual(['b:evicted', 'a:stuck'])
  })

  it('flags a phone that received SMS before and has not been seen for a week', () => {
    expect(watchFindings([device({ last_seen_at: hoursAgo(24 * 8) })], NOW).map((f) => f.kind)).toEqual(['silent'])
    expect(watchFindings([device({ last_seen_at: hoursAgo(24 * 8), last_sms_at: null })], NOW)).toEqual([])
    expect(watchFindings([device({ last_seen_at: hoursAgo(24 * 8), collects_sms: false })], NOW)).toEqual([])
  })

  it('reports nothing for a healthy phone', () => {
    expect(watchFindings([device({})], NOW)).toEqual([])
  })
})

describe('canaryState', () => {
  const result = (o: { hoursOld: number; ok: boolean }) => ({ at: hoursAgo(o.hoursOld), ok: o.ok, checks: [] })
  it('separates healthy, failing, stale and never-run', () => {
    expect(canaryState(result({ hoursOld: 2, ok: true }), NOW)).toBe('ok')
    expect(canaryState(result({ hoursOld: 2, ok: false }), NOW)).toBe('failing')
    expect(canaryState(result({ hoursOld: 40, ok: true }), NOW)).toBe('stale')
    expect(canaryState(null, NOW)).toBe('unknown')
  })
})
