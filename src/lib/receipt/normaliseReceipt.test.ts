import { describe, it, expect } from 'vitest'
import { localTodayISO } from '@/lib/utils/localDate'
import { normaliseReceipt, reconcileMissingItems, isUnknownItem, UNKNOWN_ITEM_NAMES } from './normaliseReceipt'

describe('normaliseReceipt', () => {
  it('parses a valid receipt and defaults isReceipt true when the flag is absent', () => {
    const r = normaliseReceipt(
      { merchant: 'Cafe', amount: 42.5, currency: 'EGP', category: 'Food' },
      'EGP',
    )
    expect(r.isReceipt).toBe(true)
    expect(r.merchant).toBe('Cafe')
    expect(r.amount).toBe(42.5)
    expect(r.currency).toBe('EGP')
    expect(r.category).toBe('Food')
  })

  it('honours isReceipt:false so the caller can gate the non-receipt screen', () => {
    const r = normaliseReceipt({ isReceipt: false, merchant: '', amount: 0 }, 'EGP')
    expect(r.isReceipt).toBe(false)
  })

  it('treats isReceipt:true explicitly as a receipt', () => {
    const r = normaliseReceipt({ isReceipt: true, amount: 10 }, 'EGP')
    expect(r.isReceipt).toBe(true)
  })

  it('falls back to a supported currency and Other category on garbage input', () => {
    const r = normaliseReceipt({ currency: 'XYZ', category: 'Nonsense', amount: -5 }, 'AED')
    expect(r.currency).toBe('AED')
    expect(r.category).toBe('Other')
    expect(r.amount).toBe(0)
  })

  it('replaces out-of-window dates (future / older than 30 days) with today', () => {
    // Local, to match the implementation (normaliseReceipt now returns the local day) — a
    // UTC `today` here is flaky for anyone running tests outside UTC.
    const today = localTodayISO()
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    const old = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    expect(normaliseReceipt({ amount: 1, date: future }, 'EGP').date).toBe(today)
    expect(normaliseReceipt({ amount: 1, date: old }, 'EGP').date).toBe(today)
    expect(normaliseReceipt({ amount: 1 }, 'EGP').date).toBe(today)
  })

  it('sums items + charges when the total is missing', () => {
    const r = normaliseReceipt(
      {
        amount: 0,
        items: [{ name: 'A', price: 10 }, { name: 'B', price: 5 }],
        charges: [{ type: 'tax', label: 'VAT', amount: 2 }, { type: 'discount', label: 'Promo', amount: -3 }],
      },
      'EGP',
    )
    expect(r.amount).toBe(14)
  })

  it('trusts the printed total over a summed breakdown', () => {
    const r = normaliseReceipt({ amount: 100, items: [{ name: 'A', price: 10 }] }, 'EGP')
    expect(r.amount).toBe(100)
  })

  it('carries taxIncluded (default true)', () => {
    expect(normaliseReceipt({ amount: 1 }, 'EGP').taxIncluded).toBe(true)
    expect(normaliseReceipt({ amount: 1, taxIncluded: false }, 'EGP').taxIncluded).toBe(false)
  })

  it('keeps price-0 unknown-price placeholder items', () => {
    const r = normaliseReceipt({ amount: 50, items: [{ name: 'Water', price: 0 }] }, 'EGP')
    expect(r.items).toEqual([{ name: 'Water', price: 0 }])
  })
})

describe('reconcileMissingItems', () => {
  it('distributes a deficit equally across unknown-price placeholders', () => {
    const items = [
      { name: 'A', price: 10 },
      { name: 'غير معروف', price: 0 },
      { name: 'B', price: 0 },
    ]
    const out = reconcileMissingItems(items, [], 40)
    expect(out[0].price).toBe(10)
    expect(out[1].price).toBe(15)
    expect(out[2].price).toBe(15)
    expect(out.reduce((s, it) => s + it.price, 0)).toBe(40)
  })

  it('puts the rounding remainder on the last placeholder', () => {
    const items = [
      { name: 'x', price: 0 },
      { name: 'y', price: 0 },
      { name: 'z', price: 0 },
    ]
    const out = reconcileMissingItems(items, [], 10)
    expect(out.reduce((s, it) => s + it.price, 0)).toBeCloseTo(10, 2)
  })

  it('appends a single unknown filler when there are no placeholders', () => {
    const out = reconcileMissingItems([{ name: 'A', price: 30 }], [{ type: 'tax', label: 'VAT', amount: 5 }], 50)
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual({ name: UNKNOWN_ITEM_NAMES[0], price: 15 })
  })

  it('is a no-op when the breakdown already matches the total', () => {
    const items = [{ name: 'A', price: 25 }]
    expect(reconcileMissingItems(items, [], 25)).toBe(items)
  })

  it('leaves a surplus breakdown untouched (never shrinks lines)', () => {
    const items = [{ name: 'A', price: 60 }]
    expect(reconcileMissingItems(items, [], 50)).toBe(items)
  })
})

describe('isUnknownItem', () => {
  it('flags placeholder names and zero prices', () => {
    expect(isUnknownItem({ name: 'غير معروف', price: 12 })).toBe(true)
    expect(isUnknownItem({ name: 'Unknown', price: 12 })).toBe(true)
    expect(isUnknownItem({ name: 'Water', price: 0 })).toBe(true)
    expect(isUnknownItem({ name: 'Water', price: 5 })).toBe(false)
  })
})
