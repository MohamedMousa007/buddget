import { describe, expect, it } from 'vitest'
import { useExpenseFilterStore } from './useExpenseFilterStore'
import { isInternalMoveCategory } from '@/lib/constants/categoryMeta'

describe('own-account moves in Flow (QA-90/93)', () => {
  it('ATM, transfer, top-up and exchange are internal moves; card payoff, instalments, groceries and refunds are not', () => {
    for (const c of ['ATM Cash Withdrawal', 'Transfer', 'Top up', 'Currency Exchange']) expect(isInternalMoveCategory(c)).toBe(true)
    for (const c of ['CC Payoff', 'Installment', 'Groceries', 'Savings', null, undefined]) expect(isInternalMoveCategory(c)).toBe(false)
  })

  it('moves are hidden by default, toggled by the chip, and hidden again by Reset all', () => {
    const s = useExpenseFilterStore
    expect(s.getState().showMoves).toBe(false)
    s.getState().toggleMoves()
    expect(s.getState().showMoves).toBe(true)
    s.getState().reset()
    expect(s.getState().showMoves).toBe(false)
  })
})
