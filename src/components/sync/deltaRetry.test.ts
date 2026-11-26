import { describe, expect, it, vi } from 'vitest'

vi.mock('react', () => ({ useRef: <T,>(i: T) => ({ current: i }), useEffect: () => undefined }))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/store/useFinanceStore', () => ({ useFinanceStore: { getState: vi.fn(), setState: vi.fn(), subscribe: vi.fn(), persist: { getOptions: () => ({}) } } }))
vi.mock('@/lib/store/useSettingsStore', () => ({ useSettingsStore: { getState: vi.fn() } }))
vi.mock('@/lib/store/useSyncFailures', () => ({ useSyncFailures: { getState: vi.fn() } }))
vi.mock('@/lib/supabase/remote', () => ({}))
vi.mock('@/lib/auth/cacheOwnerCheck', () => ({ cacheOwnerMismatch: () => false }))
vi.mock('@/lib/auth/clearBudgetData', () => ({ clearBudgetData: vi.fn() }))
vi.mock('@/hooks/useNetworkStatus', () => ({ isOnline: () => true, networkReady: Promise.resolve(), subscribeNetwork: vi.fn() }))

import { recordDeltaFailure, recordDeltaSuccess } from './SupabaseFinanceSync'

describe('delta pull retry counter', () => {
  it('backs off twice, then hands over to the full pull and starts over', () => {
    recordDeltaSuccess()
    expect(recordDeltaFailure()).toBe(2_000)
    expect(recordDeltaFailure()).toBe(8_000)
    expect(recordDeltaFailure()).toBeNull()
    expect(recordDeltaFailure()).toBe(2_000)
  })
  it('a success resets the count', () => {
    recordDeltaSuccess()
    recordDeltaFailure()
    recordDeltaFailure()
    recordDeltaSuccess()
    expect(recordDeltaFailure()).toBe(2_000)
  })
})
