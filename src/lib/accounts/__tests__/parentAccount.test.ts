import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/lib/store/types'
import { parentAccountFor } from '../parentAccount'

const pm = (id: string, name: string, type: PaymentMethod['type'], extra: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name, type, currency: 'EGP', isDefault: false, ...extra }) as PaymentMethod

describe('parentAccountFor', () => {
  it('names the one open account at the same bank', () => {
    expect(parentAccountFor([pm('a', 'HSBC Egypt ••0001', 'bank_account'), pm('c', 'CIB ••2000', 'bank_account')], 'HSBC Egypt')).toBe('a')
  })
  it('returns nothing when the bank has two accounts, none, or the bank is unknown', () => {
    const two = [pm('a', 'HSBC Egypt ••0001', 'bank_account'), pm('b', 'HSBC Egypt ••0110', 'bank_account')]
    expect(parentAccountFor(two, 'HSBC Egypt')).toBeUndefined()
    expect(parentAccountFor([pm('c', 'CIB ••2000', 'bank_account')], 'HSBC Egypt')).toBeUndefined()
    expect(parentAccountFor(two, null)).toBeUndefined()
  })
  it('ignores closed accounts and cards', () => {
    expect(parentAccountFor([pm('a', 'HSBC Egypt ••0001', 'bank_account', { closedAt: '2026-01-01' })], 'HSBC Egypt')).toBeUndefined()
    expect(parentAccountFor([pm('d', 'HSBC Egypt', 'debit_card')], 'HSBC Egypt')).toBeUndefined()
  })
})
