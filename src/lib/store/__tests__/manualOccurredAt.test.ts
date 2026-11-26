import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '@/lib/accounts/balance'
import { localTodayISO } from '@/lib/utils/localDate'
import { noTimeAt } from '@/lib/time/occurredAt'
import type { Debt, PaymentMethod } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const bal = () => {
  const s = S()
  return computeBalances({
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: [], convert: (a) => a,
  }).get('bank')!.balance
}
/** Account opened (balance set) at `openedAt`; the clock then sits at `now`. Callers pass no occurredAt, as every form does. */
function at(openedAt: string, now: string) {
  vi.setSystemTime(new Date(now))
  useFinanceStore.setState({
    paymentMethods: [{ id: 'bank', name: 'Bank', type: 'bank_account', currency: 'EGP', createdAt: openedAt, openingBalance: 1000, openingAt: new Date(openedAt).toISOString() } as PaymentMethod],
    debts: [{ id: 'd1', name: 'Ahmed', debtType: 'personal', originalAmount: 5000, currency: 'EGP', status: 'active', createdAt: '2026-01-01' } as unknown as Debt],
    incomeEvents: [], debtPayments: [], expenses: [], savingsTransactions: [], savingsAccounts: [], goals: [],
  })
}
const income = () => S().addIncomeEvent({ name: 'Gift', amount: 200, currency: 'EGP', sourceType: 'other', receivedDate: localTodayISO(), status: 'confirmed', paymentMethodId: 'bank' } as never)
const payDebt = () => S().addDebtPaymentWithExpense(
  { debtId: 'd1', date: localTodayISO(), amountPaid: 100, paymentMethodId: 'bank', paymentCurrency: 'EGP', originalAmount: 100, amountInPrimary: 100 },
  { date: localTodayISO(), description: 'Ahmed', category: 'Debt', amount: 100, currency: 'EGP', paymentMethodId: 'bank', isRecurring: false, linkedDebtId: 'd1', isDebtPayment: true } as never,
)

describe('QA-11 / QA-118: money logged by hand today reaches the balance at once', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('before noon: income and a debt payment count immediately, not at 12:00', () => {
    at('2026-11-01T08:00:00', '2026-11-19T09:00:00')
    income()
    payDebt()
    vi.setSystemTime(new Date('2026-11-19T09:01:00'))
    expect(bal()).toBe(1100)
  })

  it('on the day the account was opened after noon: rows logged later that day are counted', () => {
    at('2026-11-19T14:00:00', '2026-11-19T15:00:00')
    income()
    payDebt()
    vi.setSystemTime(new Date('2026-11-19T15:01:00'))
    expect(bal()).toBe(1100)
  })

  it('stamps the payment and its expense with one time, and gives back-dated rows the no-time stand-in', () => {
    at('2026-11-01T08:00:00', '2026-11-19T09:00:00')
    payDebt()
    expect(S().debtPayments[0].occurredAt).toBe(S().expenses[0].occurredAt)
    expect(S().debtPayments[0].occurredAt).toBeTruthy()
    S().addDebtPayment({ debtId: 'd1', date: '2026-11-10', amountPaid: 10 })
    S().addIncomeEvent({ name: 'Old', amount: 1, currency: 'EGP', sourceType: 'other', receivedDate: '2026-11-10', status: 'confirmed' } as never)
    expect(S().debtPayments[1].occurredAt).toBe(noTimeAt('2026-11-10'))
    expect(S().incomeEvents[0].occurredAt).toBe(noTimeAt('2026-11-10'))
  })
})
