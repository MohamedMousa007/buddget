import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deletePocketWithUndo } from '@/lib/savings/pocketUndo'
import { computeBalances } from '@/lib/accounts/balance'

describe('deletePocketWithUndo', () => {
  beforeEach(() => {
    useFinanceStore.setState({ savingsAccounts: [], savingsTransactions: [], recurringSavingsDeposits: [], goals: [] })
  })

  it('deletes the pocket and Undo brings back the pocket, its ledger, its recurring deposit and goal links', () => {
    const s = useFinanceStore.getState()
    const id = s.addSavingsAccount({ name: 'Trip', category: 'savings', type: 'vault', currency: 'EGP', openingBalance: 300 } as never)
    s.addRecurringSavingsDeposit({ accountId: id, amount: 50, dayOfMonth: 1, nextDueDate: '2026-11-01', isActive: true } as never)
    useFinanceStore.setState((st) => ({ goals: [{ id: 'g1', linkedSavingsAccountIds: [id, 'other'] } as never, ...st.goals] }))
    const before = useFinanceStore.getState()
    const txCount = before.savingsTransactions.length

    const undo = deletePocketWithUndo(id)
    const mid = useFinanceStore.getState()
    expect(mid.savingsAccounts).toHaveLength(0)
    expect(mid.savingsTransactions).toHaveLength(0)
    expect(mid.goals[0].linkedSavingsAccountIds).toEqual(['other'])

    undo()
    const after = useFinanceStore.getState()
    expect(after.savingsAccounts.map((a) => a.id)).toEqual([id])
    expect(after.savingsAccounts[0].currentBalance).toBe(300)
    expect(after.savingsTransactions).toHaveLength(txCount)
    expect(after.recurringSavingsDeposits).toHaveLength(1)
    expect(after.goals[0].linkedSavingsAccountIds).toEqual([id, 'other'])
  })
})

describe('deleting a held pocket freezes the account (S-2)', () => {
  const S = () => useFinanceStore.getState()
  const bank = { id: 'H', name: 'H', type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2026-01-01', openingBalance: 10000, openingAt: '2026-01-01T00:00:00.000Z' } as never
  const pocket = (id: string, over: Record<string, unknown> = {}) =>
    ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 3000, createdAt: '2026-01-01', ...over }) as never
  const ledger = () => {
    const s = S()
    return {
      paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
      savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments, convert: (a: number) => a,
    }
  }
  const hBalance = () => computeBalances(ledger()).get('H')!.balance
  beforeEach(() => {
    useFinanceStore.setState({
      paymentMethods: [bank], savingsAccounts: [pocket('Trip', { heldInPaymentMethodId: 'H' }), pocket('Q', { currentBalance: 500 })],
      savingsTransactions: [], recurringSavingsDeposits: [], incomeEvents: [], expenses: [], debtPayments: [], debts: [], goals: [], accountAdjustments: [],
    })
  })

  it('spend then delete: the account balance is the same before and after, and Undo leaves no adjustment', () => {
    S().withdrawFromSavings('Trip', 600, 'EGP', undefined, 'spend')
    expect(hBalance()).toBe(9400)
    const undo = deletePocketWithUndo('Trip')
    expect(hBalance()).toBe(9400)
    expect(S().accountAdjustments).toHaveLength(1)
    expect(S().accountAdjustments[0]).toMatchObject({ paymentMethodId: 'H', delta: -600, reason: 'manual_update' })
    undo()
    expect(S().accountAdjustments).toHaveLength(0)
    expect(S().savingsAccounts.find((a) => a.id === 'Trip')?.updatedAt).toBeTruthy()
    expect(hBalance()).toBe(9400)
  })
  it('a held pocket with no crossing rows writes no adjustment', () => {
    deletePocketWithUndo('Trip')
    expect(S().accountAdjustments).toHaveLength(0)
    expect(hBalance()).toBe(10000)
  })
  it('a standalone pocket writes none', () => {
    S().withdrawFromSavings('Q', 100, 'EGP', undefined, 'spend')
    deletePocketWithUndo('Q')
    expect(S().accountAdjustments).toHaveLength(0)
  })
})
