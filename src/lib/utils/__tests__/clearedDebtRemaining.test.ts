import { describe, expect, it } from 'vitest'
import { totalDebtRemainingDetail } from '@/lib/utils/calculations'
import type { Debt, DebtPayment } from '@/lib/store/types'

const debt = (over: Partial<Debt> = {}) =>
  ({ id: 'd', debtType: 'personal', currency: 'EGP', startingBalance: 1000, status: 'active', ...over }) as unknown as Debt
const pay = (amountPaid: number) => ({ id: `p${amountPaid}`, debtId: 'd', date: '2026-11-01', amountPaid, createdAt: '2026-11-01T00:00:00Z' }) as DebtPayment

describe('BUD-39 a cleared debt is never still owed', () => {
  it('counts an active debt’s remainder', () => {
    expect(totalDebtRemainingDetail([debt()], [pay(700)], 'EGP', {}, 0, true).total).toBe(300)
  })
  it('leaves out a debt marked cleared with 300 left', () => {
    expect(totalDebtRemainingDetail([debt({ status: 'cleared' })], [pay(700)], 'EGP', {}, 0, true).total).toBe(0)
  })
  it('counts it again once it is reopened (a payment deleted)', () => {
    const reopened = debt({ status: 'active' })
    expect(totalDebtRemainingDetail([reopened, debt({ id: 'x', status: 'cleared' })], [], 'EGP', {}, 0, true).total).toBe(1000)
  })
  it('still counts a credit card marked cleared: a card revolves and is never really cleared', () => {
    const card = debt({ debtType: 'credit_card', status: 'cleared' } as Partial<Debt>)
    expect(totalDebtRemainingDetail([card], [pay(700)], 'EGP', {}, 0, true).total).toBe(300)
  })
})
