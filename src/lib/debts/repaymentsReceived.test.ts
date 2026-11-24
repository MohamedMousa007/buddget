import { describe, expect, it } from 'vitest'
import { repaymentsReceived } from './repaymentsReceived'
import type { Debt, DebtPayment } from '@/lib/store/types'

const debt = (id: string, direction: 'i_owe' | 'they_owe', over: Partial<Debt> = {}) =>
  ({ id, name: `Debt ${id}`, person: id === 'lent' ? 'Omar' : 'Bank', currency: 'EGP', startingBalance: 1000, direction, status: 'active', debtType: 'personal', ...over }) as unknown as Debt
const pay = (id: string, debtId: string, date: string, over: Partial<DebtPayment> = {}) =>
  ({ id, debtId, date, amountPaid: 100, createdAt: `${date}T00:00:00Z`, ...over }) as DebtPayment
const nov = (day: string) => day.startsWith('2026-11')

describe('BUD-90 repayments received (Flow money in)', () => {
  const debts = [debt('lent', 'they_owe'), debt('loan', 'i_owe')]

  it('lists payments on a debt owed to the user and none on a debt the user owes', () => {
    const r = repaymentsReceived(debts, [pay('a', 'lent', '2026-11-03', { paymentMethodId: 'pm-cib' }), pay('b', 'loan', '2026-11-04')], nov)
    expect(r).toEqual([expect.objectContaining({ id: 'a', person: 'Omar', amount: 100, currency: 'EGP', date: '2026-11-03', paymentMethodId: 'pm-cib' })])
  })

  it('shows the amount as entered in its own currency', () => {
    const r = repaymentsReceived(debts, [pay('a', 'lent', '2026-11-03', { amountPaid: 500, originalAmount: 10, paymentCurrency: 'USD' })], nov)
    expect(r[0]).toMatchObject({ amount: 10, currency: 'USD' })
  })

  it('keeps to the range and skips gold payments with no money amount', () => {
    const gold = debt('g', 'they_owe', { isGold: true, currency: 'XAU' } as Partial<Debt>)
    const r = repaymentsReceived([...debts, gold], [pay('old', 'lent', '2026-10-30'), pay('gr', 'g', '2026-11-02')], nov)
    expect(r).toEqual([])
  })
})
