import { describe, expect, it } from 'vitest'
import { defaultMethodId, storedMethodId } from '@/lib/accounts/resolve'
import type { PaymentMethod } from '@/lib/store/types'

// The built-in method exactly as defaultFinanceData seeds it, and the row AddAccountSheet creates when cash is tracked.
const sentinel = { id: 'pm_default_cash', name: 'Cash', type: 'cash', isDefault: true } as PaymentMethod
const realCash = { id: 'c1', name: 'Cash', type: 'cash', isDefault: false, createdAt: '2026-01-01', openingBalance: 50, openingAt: '2026-01-01T00:00:00Z' } as PaymentMethod
const card = { id: 'k1', name: 'Card', type: 'credit_card', isDefault: false } as PaymentMethod

describe('QA-50/QA-18: the Cash sentinel is never preselected or stored once a real Cash exists', () => {
  it('preselects the real Cash account when the default is the built-in one', () => {
    expect(defaultMethodId([sentinel, realCash, card])).toBe('c1')
    expect(storedMethodId('pm_default_cash', [sentinel, realCash])).toBe('c1')
  })
  it('keeps the built-in one while no real Cash exists, and any other choice as is', () => {
    expect(defaultMethodId([sentinel, card])).toBe('pm_default_cash')
    expect(storedMethodId('k1', [sentinel, realCash, card])).toBe('k1')
  })
  it('skips closed methods and returns empty when there are none', () => {
    expect(defaultMethodId([{ ...card, isDefault: true, closedAt: '2026-02-01' } as PaymentMethod, realCash])).toBe('c1')
    expect(defaultMethodId([])).toBe('')
  })
})
