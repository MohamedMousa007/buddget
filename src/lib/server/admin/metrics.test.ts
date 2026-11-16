import { describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { METRIC_MAX_AGE_MS, METRIC_REFRESH_AFTER_MS, adminMetrics } from './metrics'

const NOW = Date.parse('2026-11-16T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

function fakeService(reads: { key: string; value: unknown; computed_at: string }[][], refreshResult: boolean) {
  let read = 0
  const rpc = vi.fn(async (name: string) => (name === 'admin_refresh_metrics_if_stale' ? { data: refreshResult, error: null } : { data: `live:${name}`, error: null }))
  const service = {
    rpc,
    from: () => ({ select: () => ({ in: async () => ({ data: reads[Math.min(read++, reads.length - 1)] }) }) }),
  } as unknown as ServiceClient
  return { service, rpc }
}

describe('adminMetrics refresh on view', () => {
  it('serves a fresh cache without touching the database again', async () => {
    const { service, rpc } = fakeService([[{ key: 'overview', value: 'cached', computed_at: ago(60_000) }]], false)
    expect(await adminMetrics(service, ['overview'], NOW)).toEqual({ overview: 'cached' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refreshes once when older than 15 minutes, then serves the new rows', async () => {
    const stale = [{ key: 'overview', value: 'old', computed_at: ago(METRIC_REFRESH_AFTER_MS + 1000) }]
    const fresh = [{ key: 'overview', value: 'new', computed_at: ago(1000) }]
    const { service, rpc } = fakeService([stale, fresh], true)
    expect(await adminMetrics(service, ['overview'], NOW)).toEqual({ overview: 'new' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_refresh_metrics_if_stale', { p_max_age: '15 minutes' })
  })

  it('while another admin holds the lock, a 15-45 minute old value is still served', async () => {
    const { service, rpc } = fakeService([[{ key: 'overview', value: 'old', computed_at: ago(METRIC_REFRESH_AFTER_MS + 1000) }]], false)
    expect(await adminMetrics(service, ['overview'], NOW)).toEqual({ overview: 'old' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('computes live when the value is missing or older than 45 minutes', async () => {
    const { service, rpc } = fakeService([[{ key: 'overview', value: 'ancient', computed_at: ago(METRIC_MAX_AGE_MS + 1000) }]], false)
    expect(await adminMetrics(service, ['overview', 'feature_adoption'], NOW)).toEqual({ overview: 'live:admin_overview', feature_adoption: 'live:admin_feature_adoption' })
    expect(rpc).toHaveBeenCalledWith('admin_overview')
  })
})
