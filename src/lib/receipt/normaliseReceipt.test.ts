import { describe, it, expect } from 'vitest'
import { normaliseReceipt } from './normaliseReceipt'

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
    const today = new Date().toISOString().slice(0, 10)
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
})
