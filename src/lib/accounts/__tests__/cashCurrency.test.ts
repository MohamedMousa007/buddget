import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { FinanceStore } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { changeCashCurrency, setOpeningBalance } from '../actions'
import { computeBalances } from '../balance'
import { cashCurrency, cashThatFollowsBase } from '../resolve'

const s = () => useFinanceStore.getState()
const cash = (id: string) => s().paymentMethods.find((m) => m.id === id)!
const balanceOf = (st: FinanceStore, id: string) => computeBalances({
  paymentMethods: st.paymentMethods, expenses: st.expenses, incomeEvents: st.incomeEvents, debtPayments: st.debtPayments, debts: st.debts,
  savingsTransactions: st.savingsTransactions, savingsAccounts: st.savingsAccounts, adjustments: st.accountAdjustments,
  convert: (a, f, t) => tryConvertCurrency(a, f, t, st.exchangeRates),
}).get(id)?.balance

describe('Cash currency (QA bug 15)', () => {
  let id: string
  beforeEach(() => {
    s().reset()
    s().updateSettings({ baseCurrency: 'EGP' })
    id = s().addPaymentMethod({ name: 'Cash', type: 'cash', currency: 'AED', isDefault: false })
  })

  it('(a) the cash entry sheets ask in the Cash row\'s own currency, not the main one', () => {
    expect(cashCurrency(s().paymentMethods, 'EGP')).toBe('AED')
    s().reset()
    expect(cashCurrency(s().paymentMethods, 'EGP')).toBe('EGP') // no real Cash yet: it will be created in the main currency
  })

  it('(b) an untracked Cash is relabelled and nothing else is written', () => {
    changeCashCurrency(id, 'EGP', 0)
    expect(cash(id).currency).toBe('EGP')
    expect(cash(id).openingBalance).toBeUndefined()
    expect(s().accountAdjustments).toHaveLength(0)
  })

  it('(b) a Cash with money ends at the amount the user gives in the new currency, through an explicit adjustment', () => {
    setOpeningBalance(id, 1000, new Date('2026-11-01T00:00:00Z'))
    changeCashCurrency(id, 'EGP', 13000)
    expect(cash(id).currency).toBe('EGP')
    expect(balanceOf(s(), id)).toBe(13000)
    expect(s().accountAdjustments).toHaveLength(1)
    expect(s().accountAdjustments[0]).toMatchObject({ paymentMethodId: id, delta: 12000, reason: 'manual_update' })
  })

  it('(b) the same currency changes nothing', () => {
    setOpeningBalance(id, 1000)
    changeCashCurrency(id, 'AED', 5)
    expect(cash(id).currency).toBe('AED')
    expect(s().accountAdjustments).toHaveLength(0)
  })

  it('(c) a main-currency switch moves Cash only while it holds nothing and no row points at it', () => {
    expect(cashThatFollowsBase(s())).toBe(id)
    setOpeningBalance(id, 0)
    expect(cashThatFollowsBase(s())).toBe(id)
    setOpeningBalance(id, 50)
    expect(cashThatFollowsBase(s())).toBeNull()
  })

  it('(c) a Cash with a transaction keeps its currency', () => {
    s().addExpense({ description: 'Tea', category: 'Food & Dining', amount: 10, currency: 'AED', date: '2026-11-20', paymentMethodId: id, isRecurring: false } as never)
    expect(cashThatFollowsBase(s())).toBeNull()
  })
})
