import { describe, expect, it } from 'vitest'
import { debtPaidAmountInCurrency } from './debtPaidInCurrency'

const debt = { id: 'd', isGold: true, goldKarat: 24, currency: 'XAU' } as never
const pay = { id: 'p', debtId: 'd', amountPaid: 10 } as never

describe('debtPaidAmountInCurrency gold', () => {
  it('treats the gold price as base-currency money', () => {
    expect(debtPaidAmountInCurrency(debt, [pay], 'EGP', 'EGP', {}, 6000, true)).toBe(60_000)
  })
  it('converts base to the goal currency', () => {
    expect(debtPaidAmountInCurrency(debt, [pay], 'USD', 'EGP', { EGP_USD: 0.02 }, 6000, true)).toBeCloseTo(1200, 5)
  })
})
