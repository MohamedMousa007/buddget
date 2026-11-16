import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))

import { useBillingStore, type BillingMe } from '@/lib/billing/billingStore'
import { isLimitLayer, onLimitDenied } from './onLimitDenied'
import { useUsageStore } from './usageStore'

const me = (on: boolean): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: on, sparks: null })

beforeEach(() => {
  h.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => me(true) })
  useBillingStore.getState().reset()
  useUsageStore.setState({ events: [], shown: [], signals: { advisorUsed: false, receiptScanned: false, firstLimitSeen: false, lastLimit: null } })
})

describe('onLimitDenied', () => {
  it('does nothing while selling is off', () => {
    useBillingStore.setState({ me: me(false) })
    onLimitDenied('session', '2026-11-16T18:40:00Z')
    expect(useUsageStore.getState().events).toEqual([])
    expect(h.fetch).not.toHaveBeenCalled()
  })

  it('knows which layers are a spent limit', () => {
    for (const layer of ['session', 'week', 'sparks']) expect(isLimitLayer(layer), layer).toBe(true)
    for (const layer of ['rate', 'feature_disabled', 'unavailable', 'window_5h', undefined]) expect(isLimitLayer(layer), String(layer)).toBe(false)
  })

  it('queues the limit and remembers when it comes back; the plan is refreshed so the meters are current', () => {
    useBillingStore.setState({ me: me(true) })
    onLimitDenied('week', '2026-11-20T22:00:00Z')
    expect(useUsageStore.getState().events).toEqual([{ type: 'limit', layer: 'week' }])
    expect(useUsageStore.getState().signals.lastLimit).toEqual({ scope: 'week', resetAt: '2026-11-20T22:00:00Z' })
    expect(h.fetch).toHaveBeenCalledTimes(1)
  })

  it('a legacy spent-Sparks denial reads as the session; a rate or disabled refusal is not a limit', () => {
    useBillingStore.setState({ me: me(true) })
    onLimitDenied('sparks', null)
    onLimitDenied('rate', null)
    onLimitDenied('feature_disabled', null)
    expect(useUsageStore.getState().events).toEqual([{ type: 'limit', layer: 'session' }])
  })
})
