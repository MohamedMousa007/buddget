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

  it('drops out-of-window dates (future / older than 30 days)', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    const old = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    expect(normaliseReceipt({ amount: 1, date: future }, 'EGP').date).toBe('')
    expect(normaliseReceipt({ amount: 1, date: old }, 'EGP').date).toBe('')
  })
})
