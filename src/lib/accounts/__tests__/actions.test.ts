import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cashOut, closeAccount, ensureCashAccount, setAside, setOpeningBalance, updateBalance } from '../actions'
import { computeBalances } from '../balance'
import { detectGap } from '../gap'
import { pickablePaymentMethods } from '../kinds'

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

  it('deleting an account with history closes it instead of removing it', () => {
    cashOut(bank, 10, 'EGP')
    s().deletePaymentMethod(bank)
    expect(s().paymentMethods.find((m) => m.id === bank)?.closedAt).toBeTruthy()
  })
  it('deleting an account with no history removes it', () => {
    const empty = s().addPaymentMethod({ name: 'Empty', type: 'bank_account', currency: 'EGP', isDefault: false })
    s().deletePaymentMethod(empty)
    expect(s().paymentMethods.some((m) => m.id === empty)).toBe(false)
  })
  it('closing keeps history and frees the cards', () => {
    const card = s().addPaymentMethod({ name: 'Visa', type: 'debit_card', currency: 'EGP', isDefault: false, parentId: bank })
    closeAccount(bank)
    expect(s().paymentMethods.find((m) => m.id === bank)?.closedAt).toBeTruthy()
    expect(s().paymentMethods.find((m) => m.id === card)?.parentId).toBeUndefined()
  })
})

describe('untracked accounts', () => {
  beforeEach(() => s().reset())

  it('Set balance on an untracked bank sets the opening balance, then later updates are deltas', () => {
    const id = s().addPaymentMethod({ name: 'NBE', type: 'bank_account', currency: 'EGP', isDefault: false })
    expect(bal(id)).toBeUndefined()
    updateBalance(id, 0, 500)
    expect(s().accountAdjustments).toHaveLength(0)
    expect(bal(id)?.balance).toBe(500)
    s().updatePaymentMethod(id, { openingAt: new Date(Date.now() - 86_400_000).toISOString() })
    updateBalance(id, 500, 450)
    expect(s().accountAdjustments).toHaveLength(1)
    expect(bal(id)?.balance).toBe(450)
  })

  it('the cash sentinel is promoted to a real tracked Cash account', () => {
    updateBalance('pm_default_cash', 0, 75)
    const cash = ensureCashAccount()
    expect(bal(cash)?.balance).toBe(75)
  })

  it('a closed default hands over to an open method and closed methods are not pickable', () => {
    const a = s().addPaymentMethod({ name: 'A', type: 'bank_account', currency: 'EGP', isDefault: true })
    const b = s().addPaymentMethod({ name: 'B', type: 'bank_account', currency: 'EGP', isDefault: false })
    closeAccount(a)
    expect(s().paymentMethods.find((m) => m.id === b)?.isDefault).toBe(true)
    expect(pickablePaymentMethods(s().paymentMethods).some((m) => m.id === a)).toBe(false)
  })
})

describe('pickablePaymentMethods', () => {
  it('hides closed accounts and the cash sentinel once a real Cash exists, but keeps the selected one', () => {
    useFinanceStore.getState().reset()
    const real = useFinanceStore.getState().addPaymentMethod({ name: 'Cash', type: 'cash', currency: 'EGP', isDefault: false })
    const closed = useFinanceStore.getState().addPaymentMethod({ name: 'Old', type: 'bank_account', currency: 'EGP', isDefault: false, closedAt: '2026-01-01' })
    const all = useFinanceStore.getState().paymentMethods
    const ids = (keep?: string) => pickablePaymentMethods(all, keep).map((m) => m.id)
    expect(ids()).toContain(real)
    expect(ids()).not.toContain('pm_default_cash')
    expect(ids()).not.toContain(closed)
    expect(ids(closed)).toContain(closed)
  })
})

describe('gap lifecycle on the real store', () => {
  it('a resolving cash-out dated before the newest report clears the gap; an unrelated later row does not', () => {
    useFinanceStore.getState().reset()
    const st = () => useFinanceStore.getState()
    const bank = st().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    const t0 = Date.parse('2026-10-01T00:00:00Z')
    setOpeningBalance(bank, 1000, new Date(t0))
    const reports = [{ balance: 700, reportedAt: '2026-10-05T10:00:00Z' }, { balance: 700, reportedAt: '2026-10-06T10:00:00Z' }]
    const ledger = () => ({
      paymentMethods: st().paymentMethods, expenses: st().expenses, incomeEvents: st().incomeEvents, debtPayments: st().debtPayments,
      savingsTransactions: st().savingsTransactions, savingsAccounts: st().savingsAccounts, adjustments: st().accountAdjustments, convert: (a: number) => a,
    })
    const gap = () => detectGap(reports, (i) => computeBalances(ledger(), i).get(bank)?.balance)
    expect(gap()?.amount).toBe(-300)
    cashOut(bank, 300, 'EGP', new Date(Date.parse('2026-10-06T10:00:00Z') - 60_000))
    expect(gap()).toBeNull()
  })
  it('rows at the anchor are already inside the opening balance, and an account has no balance before it was opened', () => {
    useFinanceStore.getState().reset()
    const st = () => useFinanceStore.getState()
    const bank = st().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    const at = new Date('2026-10-05T10:00:00Z')
    setOpeningBalance(bank, 1000, at)
    st().addExpense({ description: 'x', category: 'Food', amount: 50, currency: 'EGP', date: '2026-10-05', occurredAt: at.toISOString(), paymentMethodId: bank, isRecurring: false })
    const input = { paymentMethods: st().paymentMethods, expenses: st().expenses, incomeEvents: [], debtPayments: [], savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a: number) => a }
    expect(computeBalances(input).get(bank)?.balance).toBe(1000)
    expect(computeBalances(input, at.getTime() - 1).get(bank)).toBeUndefined()
  })
})
