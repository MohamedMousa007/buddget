import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { InvestmentHolding, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { applyAssetPurchase, assetFundingId } from './assetPurchase'
import { activityMoves } from './activityMoves'
import { manualOccurredAt } from '@/lib/time/occurredAt'

const pocket = (id: string): SavingsAccount => ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance: 5000, createdAt: '2026-01-01' })
const tx = (id: string, day: string, clock: string, extra: Partial<SavingsTransaction> = {}): SavingsTransaction =>
  ({ id, accountId: 'p1', type: 'deposit', amount: 100, currency: 'EGP', date: day, occurredAt: manualOccurredAt(day, clock), ...extra }) as SavingsTransaction
const holding = (id: string, extra: Partial<InvestmentHolding> = {}): InvestmentHolding =>
  ({ id, assetType: 'gold', name: '21k gold', karat: 21, quantity: 8, currency: 'EGP', createdAt: '2026-01-01T09:00:00.000Z', ...extra })

const S = () => useFinanceStore.getState()

describe('activityMoves (Wealth Activity, live QA W3)', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      savingsAccounts: [pocket('p1')], savingsTransactions: [], investmentHoldings: [], expenses: [], paymentMethods: [],
      incomeEvents: [], goals: [], exchangeRates: { USD_EGP: 50 },
    })
  })

  it('an Outside gold buy appears, though it writes no pocket or account row', () => {
    const failed = applyAssetPurchase(S(), {
      source: { kind: 'outside' }, paid: 0, currency: 'EGP', priced: true, units: 8,
      holding: { assetType: 'gold', name: '21k gold', karat: 21, quantity: 8, goldUnit: 'grams', currency: 'EGP' },
      date: '2026-11-20', occurredAt: manualOccurredAt('2026-11-20', '10:00'),
    })
    expect(failed).toBeNull()
    const s = S()
    expect(s.savingsTransactions).toHaveLength(0)
    const moves = activityMoves({ transactions: s.savingsTransactions, holdings: s.investmentHoldings, expenses: s.expenses, accounts: s.savingsAccounts })
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ kind: 'buy', holding: { assetType: 'gold', quantity: 8 } })
    expect(moves[0].kind === 'buy' && moves[0].paidFromAccountId).toBeFalsy()
  })

  it('a buy paid from an account carries that account; a buy paid from a pocket shows only as its withdrawal', () => {
    const fromAccount = holding('h1', { purchaseDate: '2026-11-20' })
    const fromPocket = holding('h2', { purchaseDate: '2026-11-20' })
    const withdrawal = tx(assetFundingId('h2'), '2026-11-20', '09:00', { type: 'withdrawal' })
    const moves = activityMoves({
      transactions: [withdrawal],
      holdings: [fromAccount, fromPocket],
      expenses: [{ id: assetFundingId('h1'), paymentMethodId: 'cib' }],
      accounts: [pocket('p1')],
    })
    expect(moves.map((m) => m.id).sort()).toEqual([withdrawal.id, 'h1'].sort())
    expect(moves.find((m) => m.id === 'h1')).toMatchObject({ kind: 'buy', paidFromAccountId: 'cib' })
  })

  it('a holding with no purchase day is not a move', () => {
    expect(activityMoves({ transactions: [], holdings: [holding('h1')], expenses: [], accounts: [] })).toEqual([])
  })

  it('keeps pocket-to-pocket moves and money from outside; drops corrections and openings', () => {
    const moves = activityMoves({
      transactions: [
        tx('move', '2026-11-20', '08:00', { isCashFlow: false, transferGroupId: 'g1' }),
        tx('outside', '2026-11-20', '08:30', { isCashFlow: false, source: 'outside' }),
        tx('fix', '2026-11-20', '08:45', { isCashFlow: false, source: 'correction' }),
      ],
      holdings: [], expenses: [], accounts: [pocket('p1')],
    })
    expect(moves.map((m) => m.id)).toEqual(['outside', 'move'])
  })

  it('sorts every move by its time, buys included, newest first', () => {
    const buy = holding('h1', { purchaseDate: '2026-11-21' }) // created on another day: noon of the purchase day
    const moves = activityMoves({
      transactions: [tx('early', '2026-11-21', '07:24'), tx('late', '2026-11-21', '18:00'), tx('yesterday', '2026-11-20', '23:00')],
      holdings: [buy], expenses: [], accounts: [pocket('p1')],
    })
    expect(moves.map((m) => m.id)).toEqual(['late', 'h1', 'early', 'yesterday'])
  })

  it('filters buys by asset kind and limits after sorting', () => {
    const gold = holding('g', { purchaseDate: '2026-11-21' })
    const coin = holding('c', { assetType: 'crypto', purchaseDate: '2026-11-22' })
    expect(activityMoves({ transactions: [], holdings: [gold, coin], expenses: [], accounts: [], filter: 'gold' }).map((m) => m.id)).toEqual(['g'])
    expect(activityMoves({ transactions: [], holdings: [gold, coin], expenses: [], accounts: [], limit: 1 }).map((m) => m.id)).toEqual(['c'])
  })
})
