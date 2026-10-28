import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  let n = 0
  return {
    snapshot: vi.fn(() => ({ marker: ++n })),
    flushDiff: vi.fn(),
    recordFailures: vi.fn(),
    cleanups: [] as Array<() => void>,
  }
})

vi.mock('react', () => ({
  useRef: <T,>(init: T) => ({ current: init }),
  useEffect: (fn: () => void | (() => void)) => {
    const cleanup = fn()
    if (cleanup) h.cleanups.push(cleanup)
  },
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => ({ auth: {} })) }))
vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: {
    getState: vi.fn(() => ({ profile: { id: 'u1' }, setDataReady: vi.fn() })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    persist: { getOptions: () => ({ version: 1 }) },
  },
}))
vi.mock('@/lib/store/useSettingsStore', () => ({
  useSettingsStore: { getState: vi.fn(() => ({ serverSyncedFor: 'u1', markServerSynced: vi.fn(), reset: vi.fn() })) },
}))
vi.mock('@/lib/store/useSyncFailures', () => ({
  useSyncFailures: { getState: vi.fn(() => ({ recordFailures: h.recordFailures })) },
}))
vi.mock('@/lib/supabase/remote', () => ({
  pullAll: vi.fn(),
  pullDelta: vi.fn(async () => null),
  applyDelta: vi.fn(),
  readSyncCursor: vi.fn(() => null),
  writeSyncCursor: vi.fn(),
  clearSyncCursors: vi.fn(),
  decideReset: vi.fn(() => 'none'),
  readResetSeen: vi.fn(),
  writeResetSeen: vi.fn(),
  flushDiff: h.flushDiff,
  snapshot: h.snapshot,
  emptySnapshot: vi.fn(() => ({ marker: 'empty' })),
  mergeSnapshots: vi.fn(),
}))
vi.mock('@/lib/auth/cacheOwnerCheck', () => ({ cacheOwnerMismatch: () => false }))
vi.mock('@/lib/auth/clearBudgetData', () => ({ clearBudgetData: vi.fn() }))
vi.mock('@/hooks/useNetworkStatus', () => ({
  isOnline: () => true,
  networkReady: Promise.resolve(),
  subscribeNetwork: vi.fn(() => vi.fn()),
}))
vi.mock('@/hooks/remote/hydrateGuard', () => ({ markHydrated: vi.fn(), resetHydrationGuard: vi.fn() }))
vi.mock('@/lib/market/marketData', () => ({ ensureMarketDataFresh: vi.fn(async () => {}) }))
vi.mock('@/lib/theme/applyTheme', () => ({ applyTheme: vi.fn() }))

import { SupabaseFinanceSync, flushFinanceNow, suspendFinanceSync, syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'

const ok = { anyError: false, errors: [] as string[] }
const failed = { anyError: true, errors: ['expenses: boom'] }
type FlushCall = [unknown, string, { marker: number | string }, { marker: number | string }]
const calls = () => h.flushDiff.mock.calls as unknown as FlushCall[]

async function mount() {
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' })
  SupabaseFinanceSync({ userId: 'u1' })
  await vi.advanceTimersByTimeAsync(0)
}

describe('finance sync flush / re-baseline', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    h.flushDiff.mockReset()
    h.recordFailures.mockReset()
    h.snapshot.mockClear()
    h.flushDiff.mockResolvedValue(ok)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await mount()
    h.flushDiff.mockClear()
  })
  afterEach(() => {
    h.cleanups.splice(0).forEach((c) => c())
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('a failed flush keeps the baseline: the retry re-sends the same diff from the same prev snapshot', async () => {
    h.flushDiff.mockResolvedValue(failed)
    await flushFinanceNow()
    await flushFinanceNow()
    const [first, second] = calls()
    expect(first![2]).toBe(second![2])
    expect(h.recordFailures).toHaveBeenLastCalledWith(['expenses: boom'])
  })

  it('a throwing flush is recorded, resolves, and does not advance the baseline either', async () => {
    h.flushDiff.mockRejectedValue(new Error('network down'))
    await expect(flushFinanceNow()).resolves.toBeUndefined()
    await flushFinanceNow()
    const [first, second] = calls()
    expect(first![2]).toBe(second![2])
    expect(h.recordFailures).toHaveBeenLastCalledWith([expect.stringContaining('network down')])
  })

  it('a successful flush advances the baseline to what was sent and clears the failure banner', async () => {
    await flushFinanceNow()
    await flushFinanceNow()
    const [first, second] = calls()
    expect(second![2]).toBe(first![3])
    expect(h.recordFailures).toHaveBeenLastCalledWith([])
  })

  it('a failure followed by a success: the baseline moves only once the retry lands', async () => {
    h.flushDiff.mockResolvedValueOnce(failed).mockResolvedValue(ok)
    await flushFinanceNow()
    await flushFinanceNow()
    await flushFinanceNow()
    const [a, b, c] = calls()
    expect(b![2]).toBe(a![2])
    expect(c![2]).toBe(b![3])
  })

  it('syncFinanceNow flushes before it pulls, and a failed flush does not advance the baseline', async () => {
    h.flushDiff.mockResolvedValue(failed)
    await syncFinanceNow()
    await syncFinanceNow()
    const [first, second] = calls()
    expect(first![2]).toBe(second![2])
  })

  it('after suspendFinanceSync a pending flush is dropped, not sent', async () => {
    suspendFinanceSync()
    await flushFinanceNow()
    expect(h.flushDiff).not.toHaveBeenCalled()
  })
})
