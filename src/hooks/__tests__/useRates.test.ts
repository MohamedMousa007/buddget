import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react', async (orig) => {
  const o = await orig<typeof import('react')>()
  const { hooks } = await import('./liteReact')
  return { ...o, ...hooks, default: { ...o, ...hooks } }
})
vi.mock('@/lib/store/useFinanceStore', async (orig) => {
  const o = await orig<Record<string, unknown>>()
  const { hooks } = await import('./liteReact')
  const real = o.useFinanceStore as { getState: () => unknown; setState: unknown; subscribe: (cb: () => void) => () => void }
  const hook = Object.assign(
    (sel?: (s: unknown) => unknown) => hooks.useSyncExternalStore(real.subscribe, () => (sel ? sel(real.getState()) : real.getState())),
    { getState: real.getState, setState: real.setState, subscribe: real.subscribe },
  )
  return { ...o, useFinanceStore: hook }
})
const fetchExchangeRates = vi.hoisted(() => vi.fn())
vi.mock('@/lib/market/marketData', () => ({ RATES_TTL_MS: 4 * 60 * 60 * 1000, fetchExchangeRates }))

import { cleanupLite, renderLite } from './liteReact'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useRates } from '@/hooks/useRates'

describe('useRates settled', () => {
  beforeEach(() => {
    useFinanceStore.getState().reset()
    fetchExchangeRates.mockReset()
  })
  afterEach(cleanupLite)

  it('settles after a fetch that lands through updateRates (the store write re-runs the effect)', async () => {
    fetchExchangeRates.mockImplementation(async () => { await Promise.resolve(); useFinanceStore.getState().updateRates({ USD_EGP: 48.5, EGP_USD: 1 / 48.5 }) })
    const h = renderLite(() => useRates())
    expect(h.result.current.settled).toBe(false)
    await h.actAsync(async () => { for (let i = 0; i < 4; i++) await Promise.resolve() })
    expect(fetchExchangeRates).toHaveBeenCalledTimes(1)
    expect(h.result.current.settled).toBe(true)
  })

  it('settles after a failed fetch too, so the missing-rate notice can show', async () => {
    fetchExchangeRates.mockResolvedValue(undefined)
    const h = renderLite(() => useRates())
    await h.actAsync(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(h.result.current.settled).toBe(true)
  })

  it('is settled at once when rates are fresh and stamped', () => {
    useFinanceStore.getState().updateRates({ USD_EGP: 48.5 })
    const h = renderLite(() => useRates())
    expect(h.result.current.settled).toBe(true)
    expect(fetchExchangeRates).not.toHaveBeenCalled()
  })
})
