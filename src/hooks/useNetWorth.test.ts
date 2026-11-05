import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  settings: { baseCurrency: 'EGP', monthStartDay: 1, monthFilter: '2026-09' } as Record<string, unknown>,
  stats: vi.fn((_key?: string) => ({ receivedIncome: 0, cashOutflow: 0, debtRemainingTotal: 0 })),
}))

vi.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }))
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }))
vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: (select: (s: unknown) => unknown) =>
    select({ settings: state.settings, savingsAccounts: [], investmentHoldings: [], debts: [], paymentMethods: [], exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: false }),
}))
vi.mock('@/hooks/useMonthlyStats', () => ({ useMonthlyStats: (key?: string) => state.stats(key) }))
vi.mock('@/hooks/useRates', () => ({ useRates: () => undefined }))
vi.mock('@/hooks/useAssetPrices', () => ({ useAssetPrices: () => ({ lookup: () => null }) }))
vi.mock('@/lib/accounts/useAccounts', () => ({ useLedgerInput: () => ({}) }))
vi.mock('@/lib/accounts/netWorthBasis', () => ({ accountsBasisFor: () => ({}) }))
vi.mock('@/lib/spending/exclusion', () => ({ countedDebts: (d: unknown) => d, countedDebtPayments: (d: unknown) => d }))

import { cycleKeyFor } from '@/lib/settings/payCycle'
import { useNetWorth } from './useNetWorth'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 5, 12))
  state.stats.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('useNetWorth reads the current cycle, not the month being browsed (MON-6)', () => {
  it('asks for the stats of the current cycle even when another month is browsed', () => {
    useNetWorth()
    expect(state.stats).toHaveBeenCalledWith('2026-11')
  })

  it.each([new Date(2026, 10, 5, 12), new Date(2026, 10, 26, 12)])('follows a custom month start day (%s)', (day) => {
    state.settings = { ...state.settings, monthStartDay: 25 }
    vi.setSystemTime(day)
    useNetWorth()
    expect(state.stats).toHaveBeenLastCalledWith(cycleKeyFor(day, 25))
    expect(state.stats).not.toHaveBeenCalledWith('2026-09')
  })
})
