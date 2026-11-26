import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SavingsAccount } from '@/lib/store/types'
import { applyPocketDeposit, planPocketDeposit } from './moneySourceDeposit'

const pocket = (id: string, currency: SavingsAccount['currency'], bal: number): SavingsAccount => ({
  id, name: id, category: 'savings', type: 'vault', currency, currentBalance: bal, createdAt: '2026-01-01',
})

const S = () => useFinanceStore.getState()
const seed = (accounts: SavingsAccount[]) =>
  useFinanceStore.setState({
    savingsAccounts: accounts,
    savingsTransactions: [],
    paymentMethods: [],
    incomeEvents: [],
    goals: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  })

describe('planPocketDeposit', () => {
  it('account → allocate from that account', () => {
    expect(planPocketDeposit({ kind: 'account', id: 'cib' }, 'p1')).toEqual({ action: 'deposit', opts: { mode: 'allocate', fromAccountId: 'cib' } })
  })
  it('account with nothing picked → allocate with no leg (null), never the primary by accident', () => {
    expect(planPocketDeposit({ kind: 'account' }, 'p1')).toEqual({ action: 'deposit', opts: { mode: 'allocate', fromAccountId: null } })
  })
  it('outside → declare', () => {
    expect(planPocketDeposit({ kind: 'outside' }, 'p1')).toEqual({ action: 'deposit', opts: { mode: 'declare' } })
  })
  it('pocket → transfer from that pocket', () => {
    expect(planPocketDeposit({ kind: 'pocket', id: 'p2' }, 'p1')).toEqual({ action: 'transfer', fromPocketId: 'p2' })
  })
  it('pocket into itself or with no pocket picked → nothing', () => {
    expect(planPocketDeposit({ kind: 'pocket', id: 'p1' }, 'p1')).toEqual({ action: 'none', reason: 'same_pocket' })
    expect(planPocketDeposit({ kind: 'pocket' }, 'p1')).toEqual({ action: 'none', reason: 'no_pocket_source' })
  })
})

describe('applyPocketDeposit', () => {
  beforeEach(() => seed([pocket('p1', 'EGP', 0), pocket('p2', 'EGP', 500), pocket('usd', 'USD', 100)]))

  it('outside writes a non-cash-flow deposit: net worth rises, the budget is untouched', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 200, currency: 'EGP', source: { kind: 'outside' } })).toBe(true)
    const tx = S().savingsTransactions.at(-1)!
    expect(tx.type).toBe('deposit')
    expect(tx.isCashFlow).toBe(false)
    expect(S().savingsAccounts.find((a) => a.id === 'p1')!.currentBalance).toBe(200)
  })

  it('pocket moves money: two non-cash-flow legs, the source goes down by the same amount', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 200, currency: 'EGP', source: { kind: 'pocket', id: 'p2' } })).toBe(true)
    const legs = S().savingsTransactions
    expect(legs).toHaveLength(2)
    expect(legs.every((t) => t.isCashFlow === false && t.source === 'transfer')).toBe(true)
    expect(S().savingsAccounts.find((a) => a.id === 'p2')!.currentBalance).toBe(300)
    expect(S().savingsAccounts.find((a) => a.id === 'p1')!.currentBalance).toBe(200)
  })

  it('pocket move typed in the destination currency is converted into the source pocket’s unit first', () => {
    // 1,000 EGP into p1 from a USD pocket = 20 USD out of it.
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 1000, currency: 'EGP', source: { kind: 'pocket', id: 'usd' } })).toBe(true)
    expect(S().savingsAccounts.find((a) => a.id === 'usd')!.currentBalance).toBe(80)
    expect(S().savingsAccounts.find((a) => a.id === 'p1')!.currentBalance).toBe(1000)
  })

  it('a pocket move larger than the source holds is refused and writes nothing', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 900, currency: 'EGP', source: { kind: 'pocket', id: 'p2' } })).toBe(false)
    expect(S().savingsTransactions).toHaveLength(0)
  })

  it('a pocket into itself writes nothing', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p2', amount: 10, currency: 'EGP', source: { kind: 'pocket', id: 'p2' } })).toBe(false)
    expect(S().savingsTransactions).toHaveLength(0)
  })

  it('account (no tracked accounts) stays a budget deposit: cash flow, as before', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 100, currency: 'EGP', source: { kind: 'account' } })).toBe(true)
    expect(S().savingsTransactions.at(-1)!.isCashFlow).toBeUndefined()
  })

  it('zero or negative amounts write nothing', () => {
    expect(applyPocketDeposit(S(), { pocketId: 'p1', amount: 0, currency: 'EGP', source: { kind: 'outside' } })).toBe(false)
    expect(S().savingsTransactions).toHaveLength(0)
  })
})
