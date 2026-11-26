import { describe, expect, it } from 'vitest'
import { priceHistoryNewestFirst, priceHistoryWith } from './subscriptionPricing'

describe('priceHistoryNewestFirst (QA W4: price history reversed)', () => {
  it('a 210 typed over a 190 plan on the day it was added reads Since 210 · Before 190', () => {
    const history = priceHistoryWith({ amount: 190, startDate: '2026-11-26', priceHistory: [] }, 210, '2026-11-26')
    expect(priceHistoryNewestFirst(history).map((h) => h.amount)).toEqual([210, 190])
  })
  it('orders by the day each price took effect', () => {
    const h = [{ amount: 190, from: '2026-01-10' }, { amount: 210, from: '2026-10-17' }, { amount: 230, from: '2026-11-01' }]
    expect(priceHistoryNewestFirst(h).map((x) => x.amount)).toEqual([230, 210, 190])
  })
  it('no history is an empty list', () => {
    expect(priceHistoryNewestFirst(undefined)).toEqual([])
  })
})
