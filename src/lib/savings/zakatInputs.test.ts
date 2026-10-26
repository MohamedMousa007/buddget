import { describe, expect, it } from 'vitest'
import { deriveZakatBase } from './zakatInputs'

const lookup = (() => null) as never
const run = (over: Record<string, unknown>) =>
  deriveZakatBase({
    savingsAccounts: [], investmentHoldings: [], debts: [], baseCurrency: 'EGP',
    exchangeRates: {}, goldPricePerGram: 6000, goldPriceAvailable: true, lookup, ...over,
  } as never)

const pocket = (over: Record<string, unknown>) =>
  ({ id: 'p', name: 'p', category: 'investment', type: 'gold', currency: 'XAU', currentBalance: 100, ...over })
const debt = (over: Record<string, unknown>) =>
  ({ id: 'd', currency: 'EGP', isGold: false, installmentAmount: 100, direction: 'i_owe', ...over })

describe('deriveZakatBase investment pockets', () => {
  it('counts investment-category gold pockets as gold', () => {
    expect(run({ savingsAccounts: [pocket({})] }).goldValue).toBe(600_000)
  })
  it('routes crypto and stock pockets to their lines and skips property', () => {
    const r = run({
      savingsAccounts: [
        pocket({ id: 'c', type: 'crypto', currency: 'EGP', currentBalance: 10 }),
        pocket({ id: 's', type: 'stocks', currency: 'EGP', currentBalance: 20 }),
        pocket({ id: 'r', type: 'real_estate', currency: 'EGP', currentBalance: 999 }),
      ],
    })
    expect([r.cryptoValue, r.stocksValue, r.goldValue, r.cashAndSavings]).toEqual([10, 20, 0, 0])
  })
})

describe('deriveZakatBase debtsDueThisYear', () => {
  it('annualises by frequency', () => {
    const r = run({
      debts: [
        debt({ id: 'a', installmentFrequency: 'weekly' }),
        debt({ id: 'b', installmentFrequency: 'quarterly' }),
        debt({ id: 'c' }),
      ],
    })
    expect(r.debtsDueThisYear).toBe(100 * 52 + 100 * 4 + 100 * 12)
  })
  it('ignores cleared debts and debts owed to the user', () => {
    const r = run({ debts: [debt({ status: 'cleared' }), debt({ direction: 'they_owe' })] })
    expect(r.debtsDueThisYear).toBe(0)
  })
})
