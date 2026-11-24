import { describe, expect, it } from 'vitest'
import { isInternalMoveCategory } from './categoryMeta'

describe('own-account moves (QA-90/93): not listed in Flow', () => {
  it('ATM, transfer, top-up and exchange are internal moves; card payoff, instalments, groceries and savings are not', () => {
    for (const c of ['ATM Cash Withdrawal', 'Transfer', 'Top up', 'Currency Exchange']) expect(isInternalMoveCategory(c)).toBe(true)
    for (const c of ['CC Payoff', 'Installment', 'Groceries', 'Savings', null, undefined]) expect(isInternalMoveCategory(c)).toBe(false)
  })
})
