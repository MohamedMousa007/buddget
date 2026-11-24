import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => {
  const o = await orig<typeof import('react')>()
  const { hooks } = await import('./liteReact')
  return { ...o, ...hooks, default: { ...o, ...hooks } }
})
vi.mock('zustand/react/shallow', () => ({ useShallow: (f: unknown) => f }))
const live = vi.hoisted(() => async (orig: () => Promise<Record<string, unknown>>, key: string) => {
  const o = await orig()
  const { hooks } = await import('./liteReact')
  const real = o[key] as { getState: () => unknown; setState: unknown; subscribe: (cb: () => void) => () => void }
  const hook = Object.assign(
    (sel?: (s: unknown) => unknown) => hooks.useSyncExternalStore(real.subscribe, () => (sel ? sel(real.getState()) : real.getState())),
    { getState: real.getState, setState: real.setState, subscribe: real.subscribe },
  )
  return { ...o, [key]: hook }
})
vi.mock('@/lib/store/useFinanceStore', (orig) => live(orig as never, 'useFinanceStore'))
vi.mock('@/lib/store/useSettingsStore', (orig) => live(orig as never, 'useSettingsStore'))
vi.mock('@/lib/i18n', () => ({ useT: () => new Proxy({}, { get: () => new Proxy({}, { get: () => 'x' }) }) }))
vi.mock('@/components/ui/ActionToast', () => ({ useActionToast: () => vi.fn() }))

import { cleanupLite, renderLite } from './liteReact'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { computeBalances } from '@/lib/accounts/balance'

const DAY = 86_400_000
const st = () => useFinanceStore.getState()
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()
const cibBalance = () => computeBalances({
  paymentMethods: st().paymentMethods, expenses: st().expenses, incomeEvents: st().incomeEvents, debts: st().debts, debtPayments: st().debtPayments,
  savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a: number) => a,
}).get('cib')?.balance
const transfer = { id: 'e1', date: iso(1).slice(0, 10), occurredAt: iso(1), description: 'IPN', category: 'Instapay', amount: 5000, currency: 'EGP', paymentMethodId: 'cib', isRecurring: false, smsLogId: 'sms1', createdAt: iso(1) }

afterEach(cleanupLite)
beforeEach(() => {
  const s = useFinanceStore.getState()
  useFinanceStore.setState({
    expenses: [], incomeEvents: [], debts: [], debtPayments: [], recurringDebtPayments: [], goals: [],
    paymentMethods: [
      { id: 'cib', name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: true, openingBalance: 20000, openingAt: iso(10) },
      { id: 'visa', name: 'Visa', type: 'credit_card', currency: 'EGP', isDefault: false },
    ] as never,
    settings: { ...s.settings, baseCurrency: 'EGP', showAllCurrenciesInForms: true },
  })
  useSettingsStore.setState({ activeModal: 'addDebt', debtSheetPaymentOnly: false, editingDebtId: null } as never)
})

/** Opens the New borrow form and fills a 5,000 loan to Omar. */
function lendForm(method = 'cib') {
  const h = renderLite(() => useAddDebtSheet())
  h.act(() => {
    const d = h.result.current
    d.setDirection('they_owe'); d.setPerson('Omar'); d.setName('Loan'); d.setStartingBalance('5000'); d.setPaymentMethodId(method)
  })
  return h
}

describe('add debt: principal leg (DR-6)', () => {
  it('a tracked account with nothing to link defaults to Yes and books the leg on the debt row', () => {
    const h = lendForm()
    expect(h.result.current.principalAccount?.id).toBe('cib')
    expect(h.result.current.principalMatch).toBeNull()
    expect(h.result.current.principalMoved).toBe(true)
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts).toHaveLength(1)
    expect(st().debts[0]).toMatchObject({ direction: 'they_owe', principalPaymentMethodId: 'cib', principalAmount: 5000, principalCurrency: 'EGP' })
    expect(st().debts[0].principalAt).toBeTruthy()
    expect(cibBalance()).toBe(15000)
  })

  it('answering No books no leg', () => {
    const h = lendForm()
    h.act(() => h.result.current.setPrincipalMoved(false))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0].principalPaymentMethodId).toBeUndefined()
    expect(cibBalance()).toBe(20000)
  })

  it('a matching bank transfer is linked by default: no leg, one debit, the transfer leaves spending', () => {
    useFinanceStore.setState({ expenses: [transfer] as never })
    const h = lendForm()
    expect(h.result.current.principalMatch).toMatchObject({ kind: 'expense', id: 'e1' })
    expect(h.result.current.principalLinked).toBe(true)
    expect(h.result.current.principalMoved).toBe(false)
    h.act(() => h.result.current.handleAddDebt())
    const debt = st().debts[0]
    expect(debt.principalPaymentMethodId).toBeUndefined()
    expect(st().expenses[0]).toMatchObject({ linkedDebtId: debt.id, spendExclusion: 'manual' })
    expect(cibBalance()).toBe(15000)
  })

  it('with the link switched off the answer defaults to No; a second debit needs an explicit Yes', () => {
    useFinanceStore.setState({ expenses: [transfer] as never })
    const h = lendForm()
    h.act(() => h.result.current.setPrincipalLinked(false))
    expect(h.result.current.principalMoved).toBe(false)
    h.act(() => h.result.current.setPrincipalMoved(true))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0].principalPaymentMethodId).toBe('cib')
    expect(st().expenses[0].linkedDebtId).toBeUndefined()
    expect(st().expenses[0].spendExclusion).toBeUndefined()
    expect(cibBalance()).toBe(10000)
  })

  it('a credit card is never asked and never gets a leg', () => {
    const h = lendForm('visa')
    expect(h.result.current.principalAccount).toBeNull()
    expect(h.result.current.principalMoved).toBe(false)
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0].principalPaymentMethodId).toBeUndefined()
    expect(cibBalance()).toBe(20000)
  })

  it('a gold debt is never asked', () => {
    const h = lendForm()
    h.act(() => h.result.current.applyDebtReceivedVia('gold'))
    expect(h.result.current.principalAccount).toBeNull()
  })

  it('borrowing books the leg as money in', () => {
    const h = lendForm()
    h.act(() => h.result.current.setDirection('i_owe'))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0]).toMatchObject({ direction: 'i_owe', principalPaymentMethodId: 'cib', principalAmount: 5000 })
    expect(cibBalance()).toBe(25000)
  })

  it('saving an edit with a new amount leaves the leg exactly as it was', () => {
    const leg = { principalPaymentMethodId: 'cib', principalAmount: 5000, principalCurrency: 'EGP', principalAt: iso(1) }
    useFinanceStore.setState({ debts: [{ id: 'd1', name: 'Loan', person: 'Omar', personName: 'Omar', startingBalance: 5000, currency: 'EGP', isGold: false, debtType: 'personal', direction: 'they_owe', status: 'active', createdAt: iso(1), receivedVia: 'cash', ...leg }] as never })
    useSettingsStore.setState({ activeModal: 'editDebt', editingDebtId: 'd1' } as never)
    const h = renderLite(() => useAddDebtSheet())
    expect(h.result.current.principalAccount).toBeNull()
    h.act(() => h.result.current.setStartingBalance('9000'))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts).toHaveLength(1)
    expect(st().debts[0]).toMatchObject({ startingBalance: 9000, ...leg })
    expect(cibBalance()).toBe(15000)
  })
})
