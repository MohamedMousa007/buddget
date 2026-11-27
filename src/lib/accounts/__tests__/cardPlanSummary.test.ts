import { describe, expect, it } from 'vitest'
import type { Debt, DebtPayment, Expense } from '@/lib/store/types'
import { cardOwed } from '@/lib/debt/computeCreditCardBalance'
import { cardPlanSummary } from '../cardPlanSummary'

/** The P3 fixture's card: 4,000 of purchases plus a 12,000 TV plan (6 × 2,000, first bill Dec 10), closing on the 10th. */
const debt = (id: string, over: Partial<Debt>): Debt =>
  ({ id, name: id, person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', ...over }) as Debt
const expense = (id: string, amount: number, date: string): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId: 'card', isRecurring: false, createdAt: date }) as Expense
const CARD = debt('cardDebt', { debtType: 'credit_card', linkedPaymentMethodId: 'card', paymentDueDay: 10 })
const TV = debt('tv', {
  name: 'TV', debtType: 'installment', startingBalance: 12000, installmentCount: 6, installmentAmount: 2000,
  installmentFrequency: 'monthly', startDate: '2025-12-10', installmentProvider: 'credit_card', linkedCreditCardDebtId: 'cardDebt', createdAt: '2025-11-12',
})
const same = (a: number) => a
const NOV30 = new Date(2025, 10, 30, 18)

describe('cardPlanSummary (card sheet, Pay card)', () => {
  const rows = { expenses: [expense('cardBuys', 4000, '2025-11-20'), expense('tvBuy', 12000, '2025-11-12')], payments: [] as DebtPayment[], debts: [CARD, TV] }

  it('splits Owed into the card part and the plan principal, owed once', () => {
    const s = cardPlanSummary(CARD, rows, same, NOV30)
    expect(cardOwed(CARD, rows, same)).toBe(16000)
    expect(s.left).toBe(12000)
    expect(s.plans).toEqual([{ id: 'tv', name: 'TV', paidCount: 0, count: 6, month: 2000, left: 12000 }])
    expect(s.month).toBe(2000)
  })

  it('Full amount is the hold-back: the card part plus the instalment billed at the next close', () => {
    const s = cardPlanSummary(CARD, rows, same, NOV30)
    expect(s.dueNow).toBe(6000)
    expect(s.plansDue).toBe(2000)
  })

  it('a cleared plan drops out of the plan rows', () => {
    const s = cardPlanSummary(CARD, { ...rows, debts: [CARD, { ...TV, status: 'cleared' }] }, same, NOV30)
    expect(s.plans).toHaveLength(0)
  })
})
