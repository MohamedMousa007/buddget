import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { backfillDueDates, recurringTxId } from '@/lib/savings/recurringDue'
import { postDueRecurringSavings } from '@/lib/savings/postRecurringSavings'
import type { RecurringSavingsDeposit, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const rule = (over: Partial<RecurringSavingsDeposit> = {}): RecurringSavingsDeposit => ({
  id: 'r1', accountId: 'p1', amount: 100, currency: 'EGP', frequency: 'monthly', dayOfMonth: 5, nextDueDate: '2026-01-05', isActive: true, createdAt: '2026-01-01', ...over,
})

beforeEach(() => {
  useFinanceStore.setState({
    paymentMethods: [], savingsAccounts: [{ id: 'p1', name: 'p1', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '2026-01-01' } as SavingsAccount],
    savingsTransactions: [], incomeEvents: [], goals: [], expenses: [], debtPayments: [], recurringSavingsDeposits: [rule()],
  })
})

describe('DEB-12: missed recurring savings months are each posted, on their due date', () => {
  it('lists every missed due date, oldest first', () => {
    expect(backfillDueDates('2026-01-05', '2026-03-10', 5)).toEqual({ dues: ['2026-01-05', '2026-02-05', '2026-03-05'], next: '2026-04-05' })
    expect(backfillDueDates('2026-01-31', '2026-03-31', 31).dues).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('three missed months post three deposits dated on their due days', () => {
    postDueRecurringSavings('2026-03-10')
    const txs = S().savingsTransactions
    expect(txs.map((t) => t.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05'])
    expect(txs.map((t) => t.id)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05'].map((d) => recurringTxId('r1', d)))
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
    expect(S().recurringSavingsDeposits[0].nextDueDate).toBe('2026-04-05')
  })

  it('a long gap back-fills only the newest three', () => {
    postDueRecurringSavings('2026-08-20')
    expect(S().savingsTransactions.map((t) => t.date)).toEqual(['2026-06-05', '2026-07-05', '2026-08-05'])
    expect(S().recurringSavingsDeposits[0].nextDueDate).toBe('2026-09-05')
  })

  it('running again, or on a second device, posts nothing twice', () => {
    postDueRecurringSavings('2026-03-10')
    useFinanceStore.setState({ recurringSavingsDeposits: [rule()] })
    postDueRecurringSavings('2026-03-10')
    expect(S().savingsTransactions).toHaveLength(3)
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
  })

  it('a back-dated deposit carries no time stamp of today', () => {
    postDueRecurringSavings('2026-03-05')
    expect(S().savingsTransactions[0].occurredAt).toBeUndefined()
  })
})
