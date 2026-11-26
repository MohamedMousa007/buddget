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
const walletBalance = () => computeBalances({
  paymentMethods: st().paymentMethods, expenses: st().expenses, incomeEvents: st().incomeEvents, debts: st().debts, debtPayments: st().debtPayments,
  savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a: number) => a,
}).get('vf')?.balance

afterEach(cleanupLite)
beforeEach(() => {
  const s = useFinanceStore.getState()
  useFinanceStore.setState({
    expenses: [], incomeEvents: [], debts: [], debtPayments: [], recurringDebtPayments: [], goals: [],
    paymentMethods: [
      // Set up an hour ago: a borrow dated last week sits before the balance anchor.
      { id: 'vf', name: 'Vodafone Cash', type: 'wallet', currency: 'EGP', isDefault: true, openingBalance: 1000, openingAt: new Date(Date.now() - 3_600_000).toISOString() },
      { id: 'visa', name: 'Visa', type: 'credit_card', currency: 'EGP', isDefault: false },
    ] as never,
    settings: { ...s.settings, baseCurrency: 'EGP', showAllCurrenciesInForms: true },
  })
  useSettingsStore.setState({ activeModal: 'addDebt', debtSheetPaymentOnly: false, editingDebtId: null } as never)
})

describe('borrow dated before the account was set up (QA W4 P1)', () => {
  it('"Arrived in" on credits the account although the borrow date is before its opening balance', () => {
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => {
      const d = h.result.current
      d.setDirection('i_owe'); d.setPerson('Omar'); d.setName('Loan'); d.setStartingBalance('12000'); d.setPaymentMethodId('vf')
      d.setInstallmentStartDate(iso(6).slice(0, 10))
    })
    h.act(() => h.result.current.setPrincipalMoved(true))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0]).toMatchObject({ principalPaymentMethodId: 'vf', principalAmount: 12000 })
    expect(walletBalance()).toBe(13000)
  })

  it('an edit that keeps the early day keeps the credit', () => {
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => {
      const d = h.result.current
      d.setDirection('i_owe'); d.setPerson('Omar'); d.setName('Loan'); d.setStartingBalance('12000'); d.setPaymentMethodId('vf')
      d.setInstallmentStartDate(iso(6).slice(0, 10))
    })
    h.act(() => h.result.current.setPrincipalMoved(true))
    h.act(() => h.result.current.handleAddDebt())
    cleanupLite()
    useSettingsStore.setState({ activeModal: 'editDebt', editingDebtId: st().debts[0].id } as never)
    const e = renderLite(() => useAddDebtSheet())
    e.act(() => e.result.current.setInstallmentStartDate(iso(5).slice(0, 10)))
    e.act(() => e.result.current.handleAddDebt())
    expect(walletBalance()).toBe(13000)
  })
})

describe('installment default card (QA W4 P2)', () => {
  it('the card picked on create is saved on the plan', () => {
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => {
      const d = h.result.current
      d.setDebtType('installment'); d.setInstallmentItemName('iPhone'); d.setStartingBalance('12000'); d.setInstallmentCount('12')
    })
    h.act(() => h.result.current.setInstallmentPaidWith('visa'))
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts[0]).toMatchObject({ debtType: 'installment', defaultPaymentMethodId: 'visa' })
  })
})
