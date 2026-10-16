import { describe, expect, it } from 'vitest'
import type { InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import { buildWealth, catForAccount, emergencyState, savingsRatePct } from './wealthModel'

const acct = (o: Partial<SavingsAccount>): SavingsAccount => ({
  id: 'a', name: 'A', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 100, createdAt: '2026-01-01', ...o,
})
const gold = (o: Partial<InvestmentHolding> = {}): InvestmentHolding => ({
  id: 'h', assetType: 'gold', name: '21k', quantity: 10, currency: 'EGP', karat: 21, createdAt: '2026-01-01', ...o,
})
const lookup = (s: string) => (s === 'XAU_21K' ? { price: 6000, asOf: '2026-10-16', confidence: null } : null)
const base = { baseCurrency: 'EGP' as const, rates: {}, goldPricePerGram: 0, goldOk: false }

describe('wealth model', () => {
  it('maps accounts to categories', () => {
    expect(catForAccount(acct({ type: 'vault' }))).toBe('vault')
    expect(catForAccount(acct({ maturityDate: '2027-01-01' }))).toBe('certificate')
    expect(catForAccount(acct({ type: 'cash' }))).toBe('cash')
  })

  it('splits balances from market-priced and computes return since purchase', () => {
    const m = buildWealth({ ...base, accounts: [acct({ currentBalance: 1000 })], holdings: [gold({ unitCost: 5000 })], lookup })
    expect(m.byPricing).toEqual({ balance: 1000, market: 60000, self: 0 })
    expect(m.total).toBe(61000)
    expect(m.investReturnPct).toBeCloseTo(20)
    expect(m.categories).toEqual([{ key: 'bank', count: 1 }, { key: 'gold', count: 1 }])
  })

  it('never counts an unpriced holding and flags it', () => {
    const m = buildWealth({ ...base, accounts: [], holdings: [gold()], lookup: () => null })
    expect(m.total).toBe(0)
    expect(m.anyUnpriced).toBe(true)
    expect(m.rows[0].amount).toBeNull()
  })

  it('derives emergency state and savings rate', () => {
    expect(emergencyState(0, true)).toBe('unset')
    expect(emergencyState(100, false)).toBe('needsMoney')
    expect(emergencyState(100, true)).toBe('secured')
    expect(savingsRatePct(14, 100)).toBe(14)
    expect(savingsRatePct(5, 0)).toBeNull()
  })
})
