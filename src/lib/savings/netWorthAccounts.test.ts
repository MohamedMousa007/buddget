import { describe, expect, it } from 'vitest'
import { computeNetWorth, netWorthBasisOf, type NetWorthInput } from './netWorth'

const pocket = (id: string, balance: number) => ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance: balance }) as never
const input = (over: Partial<NetWorthInput> = {}): NetWorthInput => ({
  savingsAccounts: [pocket('held', 250), pocket('free', 100)], investmentHoldings: [], debts: [],
  settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
  exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never,
  debtRemaining: 50, ...over,
})

describe('computeNetWorth accounts basis', () => {
  it('counts no account cash when no account is tracked (no month-flow guess)', () => {
    const r = computeNetWorth(input())
    expect(r.netWorth).toBe(250 + 100 - 50)
    expect(r.accountsTotal).toBeNull()
    expect(netWorthBasisOf(r)).toBe('assets')
  })
  it('BUD-100: nothing left anywhere is exactly 0', () => {
    const r = computeNetWorth(input({ savingsAccounts: [pocket('empty', 0)], debtRemaining: 0 }))
    expect(r.netWorth).toBe(0)
  })
  it('adds account balances and skips held-in pockets', () => {
    const r = computeNetWorth(input({ accountsBasis: 900, heldInPocketIds: new Set(['held']) }))
    expect(r.netWorth).toBe(100 + 900 - 50)
    expect(r.accountsTotal).toBe(900)
    expect(netWorthBasisOf(r)).toBe('accounts')
  })
  it('leaves EGP holdings out and flags incomplete when there is no EGP rate to the base', () => {
    const holdings = [{ assetType: 'property', propertyValue: 1000 }] as never
    const r = computeNetWorth(input({
      savingsAccounts: [], investmentHoldings: holdings, debtRemaining: 0,
      settings: { baseCurrency: 'CAD', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    }))
    expect(r.totalInvestments).toBe(0)
    expect(r.netWorthIncomplete).toBe(true)
  })
  it('converts EGP holdings when the rate exists', () => {
    const holdings = [{ assetType: 'property', propertyValue: 1000 }] as never
    const r = computeNetWorth(input({
      savingsAccounts: [], investmentHoldings: holdings, debtRemaining: 0,
      exchangeRates: { USD_EGP: 50 },
      settings: { baseCurrency: 'USD', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    }))
    expect(r.totalInvestments).toBe(20)
    expect(r.netWorthIncomplete).toBe(false)
  })
})
