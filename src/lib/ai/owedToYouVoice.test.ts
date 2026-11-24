import { beforeEach, describe, expect, it } from 'vitest'
import { buildAIActionHandlerContext, executeActionItem } from '@/lib/ai/aiActionHandlers'
import type { Debt, PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const debt = (id: string, person: string, direction: 'i_owe' | 'they_owe'): Debt =>
  ({ id, name: person, person, currency: 'EGP', startingBalance: 1000, direction, status: 'active', debtType: 'personal', isGold: false }) as unknown as Debt
const cash = { id: 'pm-cash', name: 'Wallet', type: 'wallet', currency: 'EGP', isDefault: false } as PaymentMethod
const cib = { id: 'pm-cib', name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: true } as PaymentMethod
const card = { id: 'd-card', name: 'Visa', person: 'Visa', currency: 'EGP', startingBalance: 500, direction: 'i_owe', status: 'active', debtType: 'credit_card', isGold: false } as unknown as Debt

const ctx = () => buildAIActionHandlerContext(useFinanceStore.getState())

beforeEach(() => {
  useFinanceStore.setState({
    expenses: [],
    debts: [debt('d-lent', 'Omar', 'they_owe'), debt('d-owe', 'Sara', 'i_owe')],
    debtPayments: [],
    paymentMethods: [cash, cib],
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('BUD-90 voice/AI repayment of money owed to you', () => {
  it('records money received into an account, with no expense', () => {
    executeActionItem(ctx(), 'add_debt_payment', { person: 'Omar', amount: 300, paymentMethod: 'CIB' })
    const s = useFinanceStore.getState()
    expect(s.debtPayments).toHaveLength(1)
    expect(s.debtPayments[0]).toMatchObject({ debtId: 'd-lent', paymentMethodId: 'pm-cib' })
    expect(s.expenses).toHaveLength(0)
  })

  it('keeps the account on the expense, not the payment, for a debt you owe (no double debit)', () => {
    executeActionItem(ctx(), 'add_debt_payment', { person: 'Sara', amount: 300, paymentMethod: 'CIB' })
    const s = useFinanceStore.getState()
    expect(s.debtPayments[0].paymentMethodId).toBeUndefined()
    expect(s.expenses).toHaveLength(1)
    expect(s.expenses[0].paymentMethodId).toBe('pm-cib')
  })

  it('falls back to the default account when none is named, as the sheet does', () => {
    executeActionItem(ctx(), 'add_debt_payment', { person: 'Omar', amount: 300 })
    expect(useFinanceStore.getState().debtPayments[0].paymentMethodId).toBe('pm-cib')
  })
})

describe('voice clear_debt never clears a credit card', () => {
  it('leaves a card active and still clears a personal debt', () => {
    useFinanceStore.setState({ debts: [card, debt('d-owe', 'Sara', 'i_owe')] })
    executeActionItem(ctx(), 'clear_debt', { name: 'Visa' })
    executeActionItem(ctx(), 'clear_debt', { name: 'Sara' })
    const byId = new Map(useFinanceStore.getState().debts.map((x) => [x.id, x.status]))
    expect(byId.get('d-card')).toBe('active')
    expect(byId.get('d-owe')).toBe('cleared')
  })
})
