import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'

const mocks = vi.hoisted(() => ({
  financeReset: vi.fn(),
  cancelPending: vi.fn(),
  settingsReset: vi.fn(),
  resetHydrationGuard: vi.fn(),
  clearPendingAiJobs: vi.fn(),
}))

vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: { getState: vi.fn(() => ({ reset: mocks.financeReset })) },
  cancelPendingFinancePersist: mocks.cancelPending,
}))
vi.mock('@/lib/store/useSettingsStore', () => ({
  useSettingsStore: { getState: vi.fn(() => ({ reset: mocks.settingsReset })) },
}))
vi.mock('@/hooks/remote/hydrateGuard', () => ({
  resetHydrationGuard: mocks.resetHydrationGuard,
}))
vi.mock('@/lib/store/usePendingAiJobs', () => ({
  clearPendingAiJobs: mocks.clearPendingAiJobs,
}))

const STORAGE_KEYS = [
  'buddget-storage',
  'buddget-ui-settings',
  'buddget-notifications-read',
  'buddget-pending-ai-jobs',
  'buddget-pwa-install-banner-dismissed-at',
  'pwa-install-dismissed',
  'buddget_guest_nickname',
  'buddget_guest_next',
  'buddget_splash_done',
  'buddget-goal-draft',
  'buddget-goal-checkpoints',
  'buddget-debt-goal-dismissed',
  'buddget.accountGapSnooze',
]

describe('clearBudgetData', () => {
  let removeItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    removeItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { removeItem } })
    mocks.financeReset.mockClear()
    mocks.settingsReset.mockClear()
    mocks.resetHydrationGuard.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes every persisted storage key', () => {
    clearBudgetData()
    for (const key of STORAGE_KEYS) {
      expect(removeItem).toHaveBeenCalledWith(key)
    }
    expect(removeItem).toHaveBeenCalledTimes(STORAGE_KEYS.length)
  })

  it('resets finance store', () => {
    clearBudgetData()
    expect(mocks.financeReset).toHaveBeenCalledOnce()
  })

  it('drops pending debounced persists before and after the finance reset', () => {
    mocks.cancelPending.mockClear()
    mocks.financeReset.mockClear()
    clearBudgetData()
    expect(mocks.cancelPending).toHaveBeenCalledTimes(2)
    expect(mocks.cancelPending.mock.invocationCallOrder[0]).toBeLessThan(mocks.financeReset.mock.invocationCallOrder[0])
    expect(mocks.cancelPending.mock.invocationCallOrder[1]).toBeGreaterThan(mocks.financeReset.mock.invocationCallOrder[0])
  })

  it('resets settings store', () => {
    clearBudgetData()
    expect(mocks.settingsReset).toHaveBeenCalledOnce()
  })

  it('resets hydration guard', () => {
    clearBudgetData()
    expect(mocks.resetHydrationGuard).toHaveBeenCalledOnce()
  })

  it('is idempotent — calling twice does not throw and resets each time', () => {
    expect(() => {
      clearBudgetData()
      clearBudgetData()
    }).not.toThrow()
    expect(mocks.financeReset).toHaveBeenCalledTimes(2)
    expect(removeItem).toHaveBeenCalledTimes(STORAGE_KEYS.length * 2)
  })

  it('does not throw when window is undefined (SSR / Node env)', () => {
    vi.unstubAllGlobals()
    expect(() => clearBudgetData()).not.toThrow()
    expect(mocks.financeReset).toHaveBeenCalledOnce()
    expect(mocks.settingsReset).toHaveBeenCalledOnce()
  })

  it('does not throw when localStorage.removeItem throws (restricted storage)', () => {
    removeItem.mockImplementation(() => { throw new Error('SecurityError') })
    expect(() => clearBudgetData()).not.toThrow()
    expect(mocks.financeReset).toHaveBeenCalledOnce()
  })

  it('still resets stores even when finance reset throws', () => {
    mocks.financeReset.mockImplementation(() => { throw new Error('store error') })
    expect(() => clearBudgetData()).not.toThrow()
    expect(mocks.settingsReset).toHaveBeenCalledOnce()
    expect(mocks.resetHydrationGuard).toHaveBeenCalledOnce()
  })

  describe('stress — concurrent calls', () => {
    it('three concurrent calls all complete without throwing', async () => {
      await expect(
        Promise.all([
          Promise.resolve().then(() => clearBudgetData()),
          Promise.resolve().then(() => clearBudgetData()),
          Promise.resolve().then(() => clearBudgetData()),
        ]),
      ).resolves.toBeDefined()
      expect(mocks.financeReset).toHaveBeenCalledTimes(3)
    })
  })
})

describe('clearBudgetData per-user caches (OFS-2)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sweeps device-list cache, net-worth stamps and flush fingerprints of any user', () => {
    const store = new Map<string, string>([
      ['buddget_devices_cache:u1', '{}'],
      ['bdg-nw:u1:2026-11-06:EGP:legacy', '1.00'],
      ['buddget:flushed:u1', '{}'],
      ['unrelated', 'keep'],
    ])
    const storage = {
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => void store.delete(k),
    }
    vi.stubGlobal('window', { localStorage: storage })
    clearBudgetData()
    expect([...store.keys()]).toEqual(['unrelated'])
  })
})
