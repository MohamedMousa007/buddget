import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubWindow() {
  const data = new Map<string, string>()
  const bus = new EventTarget()
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  vi.stubGlobal('window', {
    localStorage,
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus),
  })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
  return { data, bus }
}

const expense = { id: '11111111-1111-4111-8111-111111111111', date: '2026-10-03', amount: 50, category: 'Food', description: 'x', currency: 'EGP' }

describe('finance persist: older persisted shape and debounced writes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('rehydrates a v21 blob (with transient dataReady/goldPriceStale keys) and keeps ledgers', async () => {
    const { data } = stubWindow()
    data.set(
      'buddget-storage',
      JSON.stringify({
        version: 21,
        state: {
          profile: { id: 'user-1', name: 'A' },
          expenses: [expense],
          dataReady: false,
          goldPriceStale: true,
          exchangeRates: { USD: 1, EGP: 50 },
          goals: [],
          settings: { baseCurrency: 'EGP', currencyDropdownScope: 'all' },
        },
      }),
    )
    const { useFinanceStore } = await import('./useFinanceStore')
    await useFinanceStore.persist.rehydrate()
    const s = useFinanceStore.getState()
    expect(s.expenses).toHaveLength(1)
    expect(s.exchangeRates.EGP).toBe(50)
    expect(s.dataReady).toBe(true)
    expect(s.goldPriceStale).toBe(false)
    expect(s.settings.showAllCurrenciesInForms).toBe(true)
  }, 30000)

  it('coalesces bursts of writes into one serialisation and flushes on page hide', async () => {
    const { data } = stubWindow()
    const spy = vi.spyOn(JSON, 'stringify')
    const { useFinanceStore } = await import('./useFinanceStore')
    spy.mockClear()
    for (let i = 0; i < 20; i++) useFinanceStore.setState({ goldPricePerGram: i })
    expect(data.get('buddget-storage')).toBeUndefined()
    vi.advanceTimersByTime(600)
    const persisted = JSON.parse(data.get('buddget-storage') as string)
    expect(persisted.state.goldPricePerGram).toBe(19)
    expect(persisted.state.dataReady).toBeUndefined()

    useFinanceStore.setState({ goldPricePerGram: 99 })
    ;(document as unknown as EventTarget).dispatchEvent(new Event('visibilitychange'))
    expect(JSON.parse(data.get('buddget-storage') as string).state.goldPricePerGram).toBe(19)
    ;(document as unknown as { visibilityState: string }).visibilityState = 'hidden'
    ;(document as unknown as EventTarget).dispatchEvent(new Event('visibilitychange'))
    expect(JSON.parse(data.get('buddget-storage') as string).state.goldPricePerGram).toBe(99)
    spy.mockRestore()
  })
})
