import { describe, expect, it } from 'vitest'
import type { Subscription } from '@/lib/store/types'
import type { DetectedSubscription } from './detectRecurringCharges'
import { buildSmsFinds, cancelledBrandKeys, chargesToLink, notASubscriptionKey } from './smsFinds'

const find = (brandKey: string, over: Partial<DetectedSubscription> = {}): DetectedSubscription => ({
  brandKey, name: brandKey, amount: 190, currency: 'EGP', billingDay: 19, sightings: 3, months: 3,
  dates: [], confidence: 'high', excerpt: null, ...over,
})
const sub = (id: string, brandKey: string, status: Subscription['status'] = 'active'): Subscription =>
  ({ id, brandKey, status }) as Subscription

describe('buildSmsFinds', () => {
  it('keeps a new brand as an Add', () => {
    expect(buildSmsFinds([find('spotify')], [], [], new Set())).toEqual([{ ...find('spotify'), match: null }])
  })
  it('absorbs a find into an existing manual subscription instead of duplicating it', () => {
    const [f] = buildSmsFinds([find('netflix')], [sub('n1', 'netflix')], [], new Set())
    expect(f.match?.id).toBe('n1')
  })
  it('stays quiet once the existing subscription already has linked charges', () => {
    expect(buildSmsFinds([find('netflix')], [sub('n1', 'netflix')], [{ linkedSubscriptionId: 'n1' }], new Set())).toEqual([])
  })
  it('never re-suggests a cancelled brand or one answered "not a subscription"', () => {
    expect(buildSmsFinds([find('netflix')], [sub('n1', 'netflix', 'cancelled')], [], new Set())).toEqual([])
    expect(buildSmsFinds([find('spotify')], [], [], new Set([notASubscriptionKey('spotify')]))).toEqual([])
  })
  it('lists cancelled brand keys for the detector to skip', () => {
    expect([...cancelledBrandKeys([sub('a', 'x', 'cancelled'), sub('b', 'y')])]).toEqual(['x'])
  })
})

describe('chargesToLink', () => {
  const e = (id: string, description: string, amount: number, extra = {}) =>
    ({ id, description, amount, currency: 'EGP', ...extra }) as never
  it('selects unlinked same-brand charges inside the amount band', () => {
    const ids = chargesToLink({ brandKey: 'netflix', amount: 190 }, [
      e('a', 'NETFLIX.COM', 190), e('b', 'Netflix', 200), e('c', 'Netflix', 400),
      e('d', 'Spotify', 190), e('f', 'Netflix', 190, { linkedSubscriptionId: 'x' }),
    ], 'EGP')
    expect(ids).toEqual(['a', 'b'])
  })
})
