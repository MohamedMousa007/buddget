import { describe, expect, it } from 'vitest'
import { matchPaymentMethodForExpense } from './matchPaymentMethodForExpense'

const methods = [
  { id: 'cash', name: 'Cash' },
  { id: 'old', name: 'Visa Gold', closedAt: '2026-01-01' },
  { id: 'blank', name: '' },
  { id: 'visa', name: 'Visa Gold 4417' },
]

describe('matchPaymentMethodForExpense', () => {
  it('does not match a one-letter hint to Cash', () => {
    expect(matchPaymentMethodForExpense('a', methods)).toBe('cash')
    expect(matchPaymentMethodForExpense('c', methods.slice().reverse())).toBe('visa')
  })
  it('ignores closed methods and blank names', () => {
    expect(matchPaymentMethodForExpense('visa gold', methods)).toBe('visa')
    expect(matchPaymentMethodForExpense('visa gold 4417 pos', [{ id: 'blank', name: '' }, { id: 'visa', name: 'Visa Gold 4417' }])).toBe('visa')
  })
  it('falls back to the first open method', () => {
    expect(matchPaymentMethodForExpense('zzz', [{ id: 'x', name: 'Old', closedAt: 'y' }, { id: 'cash', name: 'Cash' }])).toBe('cash')
  })
  it('returns null when every method is closed', () => {
    expect(matchPaymentMethodForExpense('visa', [{ id: 'v', name: 'Visa', closedAt: '2026-01-01' }])).toBeNull()
  })
})
