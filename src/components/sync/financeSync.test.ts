import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  let n = 0
  return {
    snapshot: vi.fn(() => ({ marker: ++n })),
    flushDiff: vi.fn(),
    recordFailures: vi.fn(),
    storeReset: vi.fn(),
    from: vi.fn((): unknown => { throw new Error('no table mock') }),
    cleanups: [] as Array<() => void>,
    online: true,
    saveFingerprint: vi.fn(() => true),
  }
})

vi.mock('react', () => ({
  useRef: <T,>(init: T) => ({ current: init }),
  useEffect: (fn: () => void | (() => void)) => {
    const cleanup = fn()
    if (cleanup) h.cleanups.push(cleanup)
  },
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => ({ auth: {}, from: h.from })) }))
vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: {
    getState: vi.fn(() => ({ profile: { id: 'u1' }, setDataReady: vi.fn(), reset: h.storeReset })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    persist: { getOptions: () => ({ version: 1 }) },
  },
}))
vi.mock('@/lib/store/useSettingsStore', () => ({
  useSettingsStore: { getState: vi.fn(() => ({ serverSyncedFor: 'u1', markServerSynced: vi.fn(), reset: vi.fn() })) },
}))
vi.mock('@/lib/store/useSyncFailures', () => ({
  useSyncFailures: { getState: vi.fn(() => ({ recordFailures: h.recordFailures, recordSetAside: vi.fn() })) },
}))
vi.mock('@/lib/supabase/remote', () => ({
  pullAll: vi.fn(),
  pullDelta: vi.fn(async () => null),
  hasChangesSince: vi.fn(async () => true),
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
  isOnline: () => h.online,
  networkReady: Promise.resolve(),
  subscribeNetwork: vi.fn(() => vi.fn()),
}))
vi.mock('@/hooks/remote/hydrateGuard', () => ({ markHydrated: vi.fn(), markPulled: vi.fn(), resetHydrationGuard: vi.fn() }))
vi.mock('@/lib/market/marketData', () => ({ ensureMarketDataFresh: vi.fn(async () => {}) }))
vi.mock('@/lib/theme/applyTheme', () => ({ applyTheme: vi.fn() }))
vi.mock('@/components/sync/flushedFingerprint', () => ({ baselineForBoot: (_u: string, cache: unknown) => cache, saveFingerprint: h.saveFingerprint }))

import { SupabaseFinanceSync, flushFinanceNow, flushPendingFingerprints, suspendFinanceSync, syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { applyDelta, decideReset, pullDelta } from '@/lib/supabase/remote'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

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
    h.storeReset.mockReset()
    h.from.mockReset()
    h.from.mockImplementation(() => { throw new Error('no table mock') })
    vi.mocked(applyDelta).mockClear()
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
    await expect(flushFinanceNow()).resolves.toBe(false)
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

  it('D-2: offline, the final flush sends nothing and reports the edits as not acknowledged', async () => {
    h.online = false
    try {
      await expect(flushFinanceNow()).resolves.toBe(false)
      expect(h.flushDiff).not.toHaveBeenCalled()
    } finally {
      h.online = true
    }
  })

  it('D-2: a refused flush reports the edits as not acknowledged', async () => {
    h.flushDiff.mockResolvedValue(failed)
    await expect(flushFinanceNow()).resolves.toBe(false)
  })

  it('S8d-6: leaving the page writes the delivered baseline\'s fingerprint at once, not after the idle delay', async () => {
    await flushFinanceNow()
    const delivered = calls()[0]![3]
    h.saveFingerprint.mockClear()
    flushPendingFingerprints()
    expect(h.saveFingerprint).toHaveBeenCalledWith('u1', delivered)
    flushPendingFingerprints()
    expect(h.saveFingerprint).toHaveBeenCalledTimes(1)
  })

  it('S-1: after a pull the baseline is the delivered copy plus the pulled rows, not the live store', async () => {
    const serverBase = { marker: 'server-baseline' }
    vi.mocked(pullDelta).mockResolvedValueOnce({ cursor: 'c1', profile: null, expenses: { upserts: [], deletedIds: [] } } as never)
    vi.mocked(applyDelta).mockImplementation(((local: unknown, _d: unknown, delivered: unknown) =>
      (local === delivered ? serverBase : { marker: 'merged', settings: { theme: 'light' } })) as never)
    await syncFinanceNow()
    h.flushDiff.mockClear()
    await flushFinanceNow()
    // The live store (where an edit made during the pull sits) is diffed against what the server holds, so the edit goes out.
    expect(calls()[0]![2]).toBe(serverBase)
    vi.mocked(applyDelta).mockReset()
  })

  it('S-1: offline, a flush reports nothing sent', async () => {
    h.online = false
    try {
      await syncFinanceNow().catch(() => undefined)
      expect(h.flushDiff).not.toHaveBeenCalled()
    } finally {
      h.online = true
    }
  })

  it('after suspendFinanceSync a pending flush is dropped, not sent', async () => {
    suspendFinanceSync()
    await flushFinanceNow()
    expect(h.flushDiff).not.toHaveBeenCalled()
  })

  it('QA-19: two flushes asked for at once send their writes one after the other, the second from the first one\'s result', async () => {
    let release!: (v: typeof ok) => void
    h.flushDiff.mockReturnValueOnce(new Promise((r) => { release = r })).mockResolvedValue(ok)
    const first = flushFinanceNow()
    const second = flushFinanceNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.flushDiff).toHaveBeenCalledTimes(1)
    release(ok)
    await Promise.all([first, second])
    const [a, b] = calls()
    expect(h.flushDiff).toHaveBeenCalledTimes(2)
    expect(b![2]).toBe(a![3])
  })

  it('sign-out: a final flush that queued behind a running one is still sent after the suspension', async () => {
    let release!: (v: typeof ok) => void
    h.flushDiff.mockReturnValueOnce(new Promise((r) => { release = r })).mockResolvedValue(ok)
    void flushFinanceNow()
    const final = flushFinanceNow()
    suspendFinanceSync()
    release(ok)
    await final
    expect(h.flushDiff).toHaveBeenCalledTimes(2)
  })

  it('QA-65: a pull that answers after suspendFinanceSync does not write to the store', async () => {
    let answer!: (v: unknown) => void
    vi.mocked(pullDelta).mockReturnValueOnce(new Promise((r) => { answer = r }) as never)
    const sync = syncFinanceNow()
    await vi.advanceTimersByTimeAsync(0)
    suspendFinanceSync()
    vi.mocked(useFinanceStore.setState).mockClear()
    answer({ profile: null, expenses: { upserts: [] }, cursor: 'c' })
    await sync
    expect(applyDelta).not.toHaveBeenCalled()
    expect(useFinanceStore.setState).not.toHaveBeenCalled()
  })

  it('QA-42: after an account reset a stale device wipes its copy instead of pushing its unsent edits', async () => {
    h.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data_reset_at: '2026-11-19T00:00:00Z' } }) }) }) })
    vi.mocked(decideReset).mockReturnValueOnce('wipe')
    // The real reset() puts the default profile (id 'local') back.
    h.storeReset.mockImplementation(() => vi.mocked(useFinanceStore.getState).mockReturnValue({ profile: { id: 'local' }, setDataReady: vi.fn(), reset: h.storeReset } as never))
    await syncFinanceNow()
    vi.mocked(useFinanceStore.getState).mockReturnValue({ profile: { id: 'u1' }, setDataReady: vi.fn(), reset: h.storeReset } as never)
    expect(h.storeReset).toHaveBeenCalled()
    expect(h.flushDiff).not.toHaveBeenCalled()
  })

  it('QA-22: a sync asked for while the first pull is in flight waits for it instead of downloading everything twice', async () => {
    h.cleanups.splice(0).forEach((c) => c())
    vi.mocked(useFinanceStore.getState).mockReturnValue({ profile: { id: 'local' }, setDataReady: vi.fn(), reset: h.storeReset } as never)
    vi.mocked(pullDelta).mockClear()
    let answer!: (v: unknown) => void
    vi.mocked(pullDelta).mockReturnValueOnce(new Promise((r) => { answer = r }) as never)
    await mount()
    void syncFinanceNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(pullDelta).toHaveBeenCalledTimes(1)
    answer(null)
    await vi.advanceTimersByTimeAsync(0)
    vi.mocked(useFinanceStore.getState).mockReturnValue({ profile: { id: 'u1' }, setDataReady: vi.fn(), reset: h.storeReset } as never)
  })
})
