import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { confirmRecurringDebtPayment } from '@/lib/debts/recurringDebtDueHandlers'
import { isBnplPlan } from '@/lib/debt/bnpl'
import { calculateDebtRemainingRaw } from '@/lib/utils/calculations'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import type { PaymentMethod, Debt, RecurringDebtPayment } from '@/lib/store/types'

const base = () => useFinanceStore.getState().settings.baseCurrency

const bnplPm = (): PaymentMethod => ({ id: 'bnpl1', name: 'Tabby', type: 'bnpl', currency: base(), isDefault: false })
const cashPm = (): PaymentMethod => ({ id: 'cash1', name: 'Cash', type: 'cash', currency: base(), isDefault: true })

function plan(startingBalance: number, linkedPm = 'bnpl1'): Debt {
  return {
    id: 'plan1', name: 'Sofa', person: '', startingBalance, currency: base(), isGold: false,
    debtType: 'installment', direction: 'i_owe', status: 'active',
    installmentCount: 4, installmentAmount: 250, linkedPaymentMethodId: linkedPm, createdAt: '2026-07-01',
  }
}

function schedule(amount = 250): RecurringDebtPayment {
  return {
    id: 'sch1', debtId: 'plan1', amount, currency: base(), paymentMethodId: 'cash1',
    frequency: 'monthly', nextDueDate: '2026-08-01', isActive: true, createdAt: '2026-07-01',
  }
}

function seed(debt: Debt, sched: RecurringDebtPayment) {
  useFinanceStore.setState({
    paymentMethods: [bnplPm(), cashPm()],
    debts: [debt], recurringDebtPayments: [sched],
    debtPayments: [], expenses: [], goals: [],
  })
}

describe('isBnplPlan', () => {
  it('is true only for installment debts linked to a bnpl PM', () => {
    const pms = [bnplPm(), cashPm()]
    expect(isBnplPlan(plan(1000), pms)).toBe(true)
    expect(isBnplPlan(plan(1000, 'cash1'), pms)).toBe(false)
    expect(isBnplPlan({ ...plan(1000), debtType: 'credit_card' }, pms)).toBe(false)
  })
})

describe('BNPL installment settlement', () => {
  beforeEach(() => seed(plan(1000), schedule()))

  it('records a non-spend Installment settlement that reduces remaining without adding spend', () => {
    const ok = confirmRecurringDebtPayment('sch1')
    expect(ok).toBe(true)
    const s = useFinanceStore.getState()

    // debt_payment recorded + remaining down 1000 → 750
    expect(s.debtPayments).toHaveLength(1)
    expect(calculateDebtRemainingRaw(s.debts[0], s.debtPayments, { expenses: s.expenses, exchangeRates: s.exchangeRates, allDebts: s.debts })).toBeCloseTo(750)

    // settlement expense is the non-spend `Installment` category on the funding card
    expect(s.expenses).toHaveLength(1)
    expect(s.expenses[0].category).toBe('Installment')
    expect(s.expenses[0].paymentMethodId).toBe('cash1')
    expect(isNonSpendCategory(s.expenses[0].category)).toBe(true)

    // schedule advanced (not deactivated), debt still active
    expect(s.recurringDebtPayments[0].isActive).toBe(true)
    expect(s.recurringDebtPayments[0].nextDueDate).not.toBe('2026-08-01')
    expect(s.debts[0].status).toBe('active')
  })

  it('clamps the final installment to the remaining, then deactivates + clears', () => {
    seed(plan(100), schedule(250)) // owes 100 but the slice is 250
    const ok = confirmRecurringDebtPayment('sch1')
    expect(ok).toBe(true)
    const s = useFinanceStore.getState()
    expect(s.debtPayments[0].amountPaid).toBeCloseTo(100) // clamped
    expect(s.recurringDebtPayments[0].isActive).toBe(false)
    expect(s.debts[0].status).toBe('cleared')
  })
})
