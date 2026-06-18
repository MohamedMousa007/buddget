import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => ({ auth: {} })) }))
vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: {
    getState: vi.fn(() => ({})),
    subscribe: vi.fn(() => vi.fn()),
  },
}))
vi.mock('@/lib/store/useSyncFailures', () => ({
  useSyncFailures: {
    getState: vi.fn(() => ({ failures: [] })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))
vi.mock('@/lib/supabase/remote', () => ({
  pullAll: vi.fn(),
  flushDiff: vi.fn(),
  snapshot: vi.fn(),
  emptySnapshot: vi.fn(() => ({})),
  mergeSnapshots: vi.fn(() => ({})),
}))
vi.mock('@/hooks/remote/hydrateGuard', () => ({
  markHydrated: vi.fn(),
  resetHydrationGuard: vi.fn(),
}))
vi.mock('@/lib/market/marketData', () => ({ ensureMarketDataFresh: vi.fn() }))
vi.mock('@/lib/theme/applyTheme', () => ({ applyTheme: vi.fn() }))

import { flushFinanceNow, suspendFinanceSync } from '@/components/sync/SupabaseFinanceSync'

describe('flushFinanceNow', () => {
  it('returns a Promise', () => {
    expect(flushFinanceNow()).toBeInstanceOf(Promise)
  })

  it('resolves when no pending flush is registered', async () => {
    await expect(flushFinanceNow()).resolves.toBeUndefined()
  })

  it('calling multiple times in parallel does not throw', async () => {
    await expect(
      Promise.all([flushFinanceNow(), flushFinanceNow(), flushFinanceNow()]),
    ).resolves.toBeDefined()
  })
})

describe('suspendFinanceSync', () => {
  it('does not throw', () => {
    expect(() => suspendFinanceSync()).not.toThrow()
  })

  it('calling multiple times is safe', () => {
    expect(() => {
      suspendFinanceSync()
      suspendFinanceSync()
      suspendFinanceSync()
    }).not.toThrow()
  })

  it('does not affect flushFinanceNow — flush still resolves after suspend', async () => {
    suspendFinanceSync()
    await expect(flushFinanceNow()).resolves.toBeUndefined()
  })
})
