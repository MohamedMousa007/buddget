import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cashOut, closeAccount, ensureCashAccount, setAside, setOpeningBalance, updateBalance } from '../actions'
import { computeBalances } from '../balance'

const s = () => useFinanceStore.getState()
const ledger = () => ({
  paymentMethods: s().paymentMethods, expenses: s().expenses, incomeEvents: s().incomeEvents, debtPayments: s().debtPayments,
  savingsTransactions: s().savingsTransactions, savingsAccounts: s().savingsAccounts, adjustments: s().accountAdjustments,
  convert: (a: number) => a,
})
const bal = (id: string) => computeBalances(ledger()).get(id)

describe('account actions end to end on the real store', () => {
  let bank = ''
  beforeEach(() => {
    s().reset()
    bank = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    setOpeningBalance(bank, 1000, new Date(Date.now() - 86_400_000))
  })

  it('creates one real Cash account and reuses it', () => {
    const a = ensureCashAccount()
    expect(a).not.toBe('pm_default_cash')
    expect(ensureCashAccount()).toBe(a)
    expect(s().paymentMethods.filter((m) => m.type === 'cash' && m.id !== 'pm_default_cash')).toHaveLength(1)
  })

  it('cash out lowers the bank, raises Cash and is not spend', () => {
    const cash = ensureCashAccount()
    setOpeningBalance(cash, 50, new Date(Date.now() - 86_400_000))
    cashOut(bank, 300, 'EGP')
    expect(bal(bank)?.balance).toBe(700)
    expect(bal(cash)?.balance).toBe(350)
    const e = s().expenses.at(-1)!
    expect(e.category).toBe('ATM Cash Withdrawal')
    expect(e.occurredAt).toBeTruthy()
  })

  it('set aside into a held-in pocket shrinks free but not balance; into a standalone pocket it is a transfer', () => {
    const heldId = s().addSavingsAccount({ name: 'Trip', category: 'savings', type: 'bank', currency: 'EGP', openingBalance: 0, heldInPaymentMethodId: bank } as never)
    const freeId = s().addSavingsAccount({ name: 'Safe', category: 'savings', type: 'bank', currency: 'EGP', openingBalance: 0 } as never)
    setAside(bank, heldId as string, 200, 'EGP')
    expect(bal(bank)).toMatchObject({ balance: 1000, held: 200, free: 800 })
    setAside(bank, freeId as string, 100, 'EGP')
    expect(bal(bank)?.balance).toBe(900)
  })

  it('update balance writes an adjustment that makes the ledger match, once', () => {
    expect(updateBalance(bank, 1000, 940)).toBe(-60)
    expect(bal(bank)?.balance).toBe(940)
    expect(updateBalance(bank, 940, 940)).toBe(0)
    expect(s().accountAdjustments).toHaveLength(1)
  })

  it('closing keeps history and frees the cards', () => {
    const card = s().addPaymentMethod({ name: 'Visa', type: 'debit_card', currency: 'EGP', isDefault: false, parentId: bank })
    closeAccount(bank)
    expect(s().paymentMethods.find((m) => m.id === bank)?.closedAt).toBeTruthy()
    expect(s().paymentMethods.find((m) => m.id === card)?.parentId).toBeUndefined()
  })
})
