import { describe, it, expect } from 'vitest'
import { paymentExpenseMoney } from '@/lib/debts/paymentAmounts'

describe('paymentExpenseMoney', () => {
  it('books a gram payment in base currency, never grams as money', () => {
    expect(paymentExpenseMoney(2, 'XAU', 9000, 'EGP')).toEqual({ amount: 9000, currency: 'EGP' })
  })
  it('keeps the entered amount and currency for real currencies', () => {
    expect(paymentExpenseMoney(100, 'USD', 5000, 'EGP')).toEqual({ amount: 100, currency: 'USD' })
  })
})
