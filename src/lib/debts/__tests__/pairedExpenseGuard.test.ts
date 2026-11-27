import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, PaymentMethod } from '@/lib/store/types'
import { calculateDebtRemaining } from '@/lib/utils/calculations'

const st = () => useFinanceStore.getState()
const base = () => st().settings.baseCurrency
const debt: Debt = {
  id: 'd1', name: 'Loan', person: 'Ahmed', startingBalance: 1000, currency: 'EGP', isGold: false,
  debtType: 'personal', direction: 'i_owe', status: 'active', createdAt: '2026-07-01',
}
const remainingDebt = () => calculateDebtRemaining(st().debts[0], st().debtPayments)
const method = (id: string, provisional = false) => ({ id, name: id, type: 'bank', provisional }) as unknown as PaymentMethod

function pay(amount: number) {
  st().addDebtPaymentWithExpense(
    { debtId: 'd1', date: '2026-10-01', amountPaid: amount, paymentCurrency: base() },
    { date: '2026-10-01', description: 'Loan', category: 'Debt', amount, currency: base(), paymentMethodId: 'bank', isRecurring: false, linkedDebtId: 'd1', isDebtPayment: true },
  )
  return st().expenses[0]
}

beforeEach(() => {
  useFinanceStore.setState({
    debts: [{ ...debt, currency: base() }], debtPayments: [], recurringDebtPayments: [], expenses: [], goals: [],
    paymentMethods: [method('bank'), method('other'), method('temp', true)],
  })
})

describe('an expense paired with a debt payment', () => {
  it('keeps its amount, date, account and category on edit, and still saves notes and title', () => {
    const e = pay(400)
    st().updateExpense(e.id, { amount: 10, amountInBaseCurrency: 10, date: '2026-10-09', paymentMethodId: 'other', category: 'Food', spendExclusion: 'manual', notes: 'cash at the door', description: 'Loan to Ahmed' })
    const after = st().expenses[0]
    expect(after).toMatchObject({ amount: 400, date: '2026-10-01', paymentMethodId: 'bank', category: 'Debt', notes: 'cash at the door', description: 'Loan to Ahmed' })
    expect(after.spendExclusion).toBe(e.spendExclusion)
    expect(after.occurredAt).toBe(e.occurredAt)
    expect(after.linkedDebtPaymentId).toBe(e.linkedDebtPaymentId)
  })

  it('can still be moved off a provisional account', () => {
    pay(400)
    useFinanceStore.setState((s) => ({ expenses: s.expenses.map((x) => ({ ...x, paymentMethodId: 'temp' })) }))
    st().updateExpense(st().expenses[0].id, { paymentMethodId: 'bank' })
    expect(st().expenses[0].paymentMethodId).toBe('bank')
  })

  it('deleting it removes the debt payment too, so the debt is owed again', () => {
    const e = pay(400)
    expect(remainingDebt()).toBe(600)
    st().deleteExpense(e.id)
    expect(st().expenses).toHaveLength(0)
    expect(st().debtPayments).toHaveLength(0)
    expect(remainingDebt()).toBe(1000)
  })

  it('deleting it after the payment is gone falls back to a plain delete', () => {
    const e = pay(400)
    useFinanceStore.setState({ debtPayments: [] })
    st().deleteExpense(e.id)
    expect(st().expenses).toHaveLength(0)
  })
})

describe('an unpaired expense', () => {
  it('edits and deletes exactly as before', () => {
    const id = 'lunch'
    st().addExpense({ id, date: '2026-10-01', description: 'Lunch', category: 'Food', amount: 50, currency: base(), paymentMethodId: 'bank', isRecurring: false })
    pay(400)
    st().updateExpense(id, { amount: 70, date: '2026-10-03', paymentMethodId: 'other', category: 'Other', notes: 'n' })
    expect(st().expenses.find((x) => x.id === id)).toMatchObject({ amount: 70, date: '2026-10-03', paymentMethodId: 'other', category: 'Other', notes: 'n' })
    st().deleteExpense(id)
    expect(st().expenses.some((x) => x.id === id)).toBe(false)
    expect(st().debtPayments).toHaveLength(1)
  })
})
