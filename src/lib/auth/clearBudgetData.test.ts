import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'

const mocks = vi.hoisted(() => ({
  financeReset: vi.fn(),
  settingsReset: vi.fn(),
  resetHydrationGuard: vi.fn(),
  clearPendingAiJobs: vi.fn(),
}))

vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: { getState: vi.fn(() => ({ reset: mocks.financeReset })) },
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
