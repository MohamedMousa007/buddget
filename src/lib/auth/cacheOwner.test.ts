import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: { profile: { id: 'local' }, settings: {} } as { profile: { id: string } },
  settingsState: { serverSyncedFor: null as string | null },
  clearBudgetData: vi.fn(),
  suspend: vi.fn(),
}))

vi.mock('@/lib/store/useFinanceStore', () => ({ useFinanceStore: { getState: () => mocks.state } }))
vi.mock('@/lib/store/useSettingsStore', () => ({ useSettingsStore: { getState: () => mocks.settingsState } }))
vi.mock('@/lib/auth/clearBudgetData', () => ({ clearBudgetData: mocks.clearBudgetData }))
vi.mock('@/components/sync/SupabaseFinanceSync', () => ({ suspendFinanceSync: mocks.suspend }))

import { cacheOwnerMismatch, reconcileCacheOwner } from '@/lib/auth/cacheOwner'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.profile.id = 'local'
  mocks.settingsState.serverSyncedFor = null
})

describe('cacheOwnerMismatch', () => {
  it('treats an unowned cache as fine', () => {
    expect(cacheOwnerMismatch(null, 'A')).toBe(false)
    expect(cacheOwnerMismatch('local', 'A')).toBe(false)
  })
  it('flags a cache owned by someone else', () => {
    expect(cacheOwnerMismatch('B', 'A')).toBe(true)
    expect(cacheOwnerMismatch('A', 'A')).toBe(false)
  })
})

describe('reconcileCacheOwner', () => {
  it('wipes (suspending sync first) when the persisted profile belongs to another user', () => {
    mocks.state.profile.id = 'B'
    expect(reconcileCacheOwner('A')).toBe(true)
    expect(mocks.suspend).toHaveBeenCalled()
    expect(mocks.clearBudgetData).toHaveBeenCalled()
  })
  it('wipes when only the settings owner marker belongs to another user', () => {
    mocks.settingsState.serverSyncedFor = 'B'
    expect(reconcileCacheOwner('A')).toBe(true)
    expect(mocks.clearBudgetData).toHaveBeenCalled()
  })
  it('keeps the cache for the same user or an unowned cache', () => {
    mocks.state.profile.id = 'A'
    expect(reconcileCacheOwner('A')).toBe(false)
    mocks.state.profile.id = 'local'
    expect(reconcileCacheOwner('A')).toBe(false)
    expect(mocks.clearBudgetData).not.toHaveBeenCalled()
  })
})
