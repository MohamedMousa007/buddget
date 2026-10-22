import { describe, expect, it } from 'vitest'
import { computeNetWorth, type NetWorthInput } from './netWorth'

const pocket = (id: string, balance: number) => ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance: balance }) as never
const input = (over: Partial<NetWorthInput> = {}): NetWorthInput => ({
  savingsAccounts: [pocket('held', 250), pocket('free', 100)], investmentHoldings: [], debts: [],
  settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
  exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never,
  monthlyIncome: 1000, cashOutflow: 400, debtRemaining: 50, ...over,
})

describe('computeNetWorth accounts basis', () => {
  it('keeps the legacy formula when no account is tracked', () => {
    const r = computeNetWorth(input())
    expect(r.netWorth).toBe(250 + 100 + 600 - 50)
    expect(r.accountsTotal).toBeNull()
  })
  it('replaces the flow term with account balances and skips held-in pockets', () => {
    const r = computeNetWorth(input({ accountsBasis: 900, heldInPocketIds: new Set(['held']) }))
    expect(r.netWorth).toBe(100 + 900 - 50)
    expect(r.accountsTotal).toBe(900)
  })
})
