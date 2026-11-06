import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const expense = { id: '11111111-1111-4111-8111-111111111111', date: '2026-10-03', amount: 50, category: 'Food', description: 'x', currency: 'EGP' } as never

/** Two tabs: separate window + module instance each, one shared localStorage that notifies the OTHER tab like a browser. */
function openTabs() {
  const data = new Map<string, string>()
  const buses: EventTarget[] = []
  // Module code reads the global `window` lazily, so the tab that is acting is named by the test.
  let writer: EventTarget | null = null
  const windowFor = (self: EventTarget) => ({
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (data.get(k) === v) return
        data.set(k, v)
        for (const bus of buses) if (bus !== writer) bus.dispatchEvent(Object.assign(new Event('storage'), { key: k, newValue: v }))
      },
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener: self.addEventListener.bind(self),
    removeEventListener: self.removeEventListener.bind(self),
    dispatchEvent: self.dispatchEvent.bind(self),
  })
  const open = async () => {
    vi.resetModules()
    const bus = new EventTarget()
    buses.push(bus)
    vi.stubGlobal('window', windowFor(bus))
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
    const { useFinanceStore } = await import('@/lib/store/useFinanceStore')
    return { store: useFinanceStore, bus }
  }
  return { data, open, as: (tab: { bus: EventTarget }) => void (writer = tab.bus) }
}

describe('OFS-7: two tabs of the persisted finance store', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('a stale second tab does not clobber the first tab’s edit', async () => {
    const { data, open, as } = openTabs()
    const a = await open()
    const b = await open()
    as(a)
    a.store.setState({ expenses: [expense] })
    await vi.advanceTimersByTimeAsync(400)
    await vi.advanceTimersByTimeAsync(0)
    expect(b.store.getState().expenses).toHaveLength(1)
    as(b)
    b.store.setState({ goldPricePerGram: 123 })
    await vi.advanceTimersByTimeAsync(400)
    const persisted = JSON.parse(data.get('buddget-storage') as string).state
    expect(persisted.expenses).toHaveLength(1)
    expect(persisted.goldPricePerGram).toBe(123)
  })

  it('edits flow both ways without echo loops', async () => {
    const { open, as } = openTabs()
    const a = await open()
    const b = await open()
    as(a)
    a.store.setState({ goldPricePerGram: 11 })
    await vi.advanceTimersByTimeAsync(400)
    as(b)
    b.store.setState({ expenses: [expense] })
    await vi.advanceTimersByTimeAsync(400)
    expect(a.store.getState().goldPricePerGram).toBe(11)
    expect(a.store.getState().expenses).toHaveLength(1)
    expect(b.store.getState().goldPricePerGram).toBe(11)
  })
})
