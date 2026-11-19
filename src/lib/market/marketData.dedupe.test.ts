import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/store/useFinanceStore', () => ({
  useFinanceStore: {
    getState: () => ({
      updateRates: vi.fn(),
      updateGoldPrice: vi.fn(),
      setGoldUnavailable: vi.fn(),
      settings: { baseCurrency: 'EGP' },
      exchangeRates: {},
    }),
  },
}))

const fetchMock = vi.fn()

describe('fetchExchangeRates in-flight dedupe', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ rates: { USD: 1 } }) }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shares one request across concurrent callers and allows a new one after settle', async () => {
    const { fetchExchangeRates } = await import('./marketData')
    await Promise.all(Array.from({ length: 8 }, () => fetchExchangeRates()))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await fetchExchangeRates()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('fetchGoldPrice in-flight dedupe', () => {
  it('shares one /api/gold request across concurrent callers and allows a new one after settle', async () => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ available: false }) }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchGoldPrice } = await import('./marketData')
    await Promise.all([fetchGoldPrice(), fetchGoldPrice(), fetchGoldPrice()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await fetchGoldPrice()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
