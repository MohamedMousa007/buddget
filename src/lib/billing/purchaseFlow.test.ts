import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn(), purchase: vi.fn(), restore: vi.fn(), me: [] as unknown[] }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))
vi.mock('./purchases', () => ({ purchasePackage: h.purchase, restorePurchases: h.restore }))

import { storeConfirmed, useBillingStore, type BillingMe } from './billingStore'
import { completePurchase, completeRestore, shelfOf } from './purchaseFlow'

const FUTURE = '2099-01-01T00:00:00Z'
const trial = (): BillingMe => ({ planKey: 'plus_trial', planName: 'Pro', status: 'trialing', trialEndsAt: FUTURE, billingEnabled: true, sparks: null, subscription: { fromStore: false, billingIssue: false, graceEndsAt: null, willRenew: null, renewsAt: null, productId: null, memberSince: null } })
const storePro = (): BillingMe => ({ planKey: 'plus', planName: 'Pro', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, subscription: { fromStore: true, billingIssue: false, graceEndsAt: null, willRenew: true, renewsAt: FUTURE, productId: 'pro_monthly', memberSince: null } })
const lapsedStore = (): BillingMe => ({ ...storePro(), planKey: 'free', status: 'expired', subscription: { ...storePro().subscription!, willRenew: false, renewsAt: '2020-01-01T00:00:00Z' } })
const pkg = {} as never
const syncCalls = () => h.fetch.mock.calls.filter(([url]) => url === '/api/billing/sync')

/** `/me` answers the queued plans in turn, then keeps the last; the sync route just answers. */
function server(...plans: BillingMe[]) {
  h.me = plans
  h.fetch.mockImplementation(async (url: string) => {
    if (url === '/api/billing/sync') return { ok: true, json: async () => ({ ok: true }) }
    const me = h.me.length > 1 ? h.me.shift() : h.me[0]
    return { ok: true, json: async () => me }
  })
}

beforeEach(() => {
  h.fetch.mockReset(); h.purchase.mockReset(); h.restore.mockReset()
  useBillingStore.getState().reset()
})

describe('storeConfirmed: what "Welcome to Pro" waits for', () => {
  it('a trial is not store Pro, a lapsed store row is not, an active store row is', () => {
    expect(storeConfirmed(trial())).toBe(false)
    expect(storeConfirmed(lapsedStore())).toBe(false)
    expect(storeConfirmed(storePro())).toBe(true)
    expect(storeConfirmed(null)).toBe(false)
  })
})

describe('shelfOf: the buy button never waits forever and never sells nothing', () => {
  const some = [{}] as never[]
  it('loading only while the SDK starts or the packages are on their way', () => {
    expect(shelfOf(true, 'starting', null)).toBe('loading')
    expect(shelfOf(true, 'idle', null)).toBe('loading')
    expect(shelfOf(true, 'ready', null)).toBe('loading')
  })
  it('unavailable when the store is not here, the SDK failed to start, or the store listed no package', () => {
    expect(shelfOf(false, 'idle', null)).toBe('unavailable')
    expect(shelfOf(true, 'failed', some)).toBe('unavailable')
    expect(shelfOf(true, 'ready', [])).toBe('unavailable')
  })
  it('ready with packages', () => expect(shelfOf(true, 'ready', some)).toBe('ready'))
})

describe('completePurchase', () => {
  it('BDG-019: a trial that stays a trial on the server is not confirmed, even though a trial counts as paid', async () => {
    h.purchase.mockResolvedValue('purchased')
    server(trial())
    expect(await completePurchase(pkg, 0)).toBe('pending')
    expect(syncCalls()).toHaveLength(1)
  })
  it('confirmed as soon as the webhook shows store Pro, without asking the store again', async () => {
    h.purchase.mockResolvedValue('purchased')
    server(trial(), storePro())
    expect(await completePurchase(pkg, 0)).toBe('confirmed')
    expect(syncCalls()).toHaveLength(0)
  })
  it('a missed webhook is recovered by the on-demand store read', async () => {
    h.purchase.mockResolvedValue('purchased')
    server(trial(), trial(), trial(), storePro())
    expect(await completePurchase(pkg, 0)).toBe('confirmed')
    expect(syncCalls()).toHaveLength(1)
  })
  it('cancelled and failed pass through and touch nothing', async () => {
    h.purchase.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('failed')
    expect(await completePurchase(pkg, 0)).toBe('cancelled')
    expect(await completePurchase(pkg, 0)).toBe('failed')
    expect(h.fetch).not.toHaveBeenCalled()
  })
})

describe('completeRestore', () => {
  it('"Nothing to restore" for a trial when the store has nothing, even though the restore call succeeded', async () => {
    h.restore.mockResolvedValue('restored')
    server(trial())
    expect(await completeRestore(trial())).toBe('nothing')
    expect(syncCalls()).toHaveLength(1)
  })
  it('"Nothing to restore" when store Pro was already there before the tap', async () => {
    h.restore.mockResolvedValue('restored')
    server(storePro())
    expect(await completeRestore(storePro())).toBe('nothing')
  })
  it('restored when the store read brings store Pro that was not there', async () => {
    h.restore.mockResolvedValue('restored')
    server(storePro())
    expect(await completeRestore(trial())).toBe('restored')
  })
  it('a failed restore is nothing and asks the server nothing', async () => {
    h.restore.mockResolvedValue('failed')
    expect(await completeRestore(trial())).toBe('nothing')
    expect(h.fetch).not.toHaveBeenCalled()
  })
})
