import { describe, expect, it } from 'vitest'
import { debtPaymentForWithdrawal } from '@/lib/debts/withdrawalPayment'
import type { Debt } from '@/lib/store/types'

const rates = { USD_EGP: 50, EGP_USD: 0.02 }
const money = { currency: 'USD', isGold: false } as unknown as Debt
const gold = { currency: 'XAU', isGold: true, goldKarat: 24 } as unknown as Debt

describe('debtPaymentForWithdrawal', () => {
  it('converts into the debt currency', () => {
    const r = debtPaymentForWithdrawal({ debt: money, amount: 500, currency: 'EGP', base: 'EGP', rates, goldPricePerGram: 4000, goldAvailable: true })
    expect(r.amountPaid).toBeCloseTo(10, 6)
    expect(r.amountInBase).toBe(500)
  })

  it('pays nothing against a gold debt while the gold price is unavailable, so the caller can abort', () => {
    const r = debtPaymentForWithdrawal({ debt: gold, amount: 500, currency: 'EGP', base: 'EGP', rates, goldPricePerGram: 0, goldAvailable: false })
    expect(r.amountPaid).toBe(0)
  })

  it('converts money to grams for a gold debt', () => {
    const r = debtPaymentForWithdrawal({ debt: gold, amount: 4000, currency: 'EGP', base: 'EGP', rates, goldPricePerGram: 4000, goldAvailable: true })
    expect(r.amountPaid).toBeCloseTo(1, 6)
  })
})
