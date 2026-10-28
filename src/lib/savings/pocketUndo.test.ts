import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deletePocketWithUndo } from '@/lib/savings/pocketUndo'

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
