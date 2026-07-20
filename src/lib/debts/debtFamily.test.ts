import { describe, it, expect } from 'vitest'
import type { Debt } from '@/lib/store/types'
import { debtFamily, firstNonEmptyFamily } from './debtFamily'

const d = (p: Partial<Debt>): Debt => ({ id: 'x', name: 'x', person: '', startingBalance: 100, currency: 'AED', isGold: false, createdAt: '', ...p })

describe('debtFamily', () => {
  it('classifies by type', () => {
    expect(debtFamily(d({ debtType: 'credit_card' }))).toBe('credit_card')
    expect(debtFamily(d({ debtType: 'installment' }))).toBe('installment')
    expect(debtFamily(d({ debtType: 'personal' }))).toBe('borrow')
  })
  it('routes scheduled general to installment, lump general to borrow', () => {
    expect(debtFamily(d({ debtType: 'general', installmentCount: 6 }))).toBe('installment')
    expect(debtFamily(d({ debtType: 'general' }))).toBe('borrow')
  })
})

describe('firstNonEmptyFamily', () => {
  it('picks the first family (borrow→card→installment) with an active debt', () => {
    expect(firstNonEmptyFamily([d({ debtType: 'installment' }), d({ debtType: 'credit_card' })])).toBe('credit_card')
    expect(firstNonEmptyFamily([d({ debtType: 'installment' })])).toBe('installment')
  })
  it('ignores cleared debts and falls back to borrow when empty', () => {
    expect(firstNonEmptyFamily([d({ debtType: 'credit_card', status: 'cleared' })])).toBe('borrow')
    expect(firstNonEmptyFamily([])).toBe('borrow')
  })
})
