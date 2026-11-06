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

const st = () => useFinanceStore.getState()

afterEach(cleanupLite)
beforeEach(() => {
  const s = useFinanceStore.getState()
  useFinanceStore.setState({
    expenses: [], debtPayments: [], recurringDebtPayments: [],
    paymentMethods: [{ id: 'pm1', name: 'Cash', type: 'cash', isDefault: true }] as never,
    debts: [{ id: 'd1', name: 'Loan', person: 'A', startingBalance: 100, currency: 'EGP', isGold: false, debtType: 'general', direction: 'i_owe', status: 'active', createdAt: '2026-01-01T00:00:00Z', receivedVia: 'cash' }] as never,
    settings: { ...s.settings, baseCurrency: 'EGP', showAllCurrenciesInForms: true },
  })
  useSettingsStore.setState({ activeModal: 'payDebt', debtSheetPaymentOnly: true } as never)
})

describe('pay debt (FRM-4)', () => {
  it('the exiting sheet\'s frozen handler cannot pay a cleared 100 debt a second time', () => {
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => { h.result.current.selectDebtForPayFlow('d1'); h.result.current.setPaymentAmount('100') })
    const frozen = h.result.current.handleAddPayment
    h.act(() => frozen())
    h.act(() => frozen())
    expect(st().debtPayments).toHaveLength(1)
    expect(st().expenses).toHaveLength(1)
    expect(st().debtPayments.reduce((s, p) => s + p.amountPaid, 0)).toBe(100)
  })

  it('even without the guard the store refuses the second payment (defence in depth)', () => {
    const payment = { debtId: 'd1', date: '2026-11-05', amountPaid: 100, paymentCurrency: 'EGP' as const }
    st().addDebtPayment(payment)
    st().addDebtPayment(payment)
    expect(st().debtPayments).toHaveLength(1)
  })

  it('a refused payment (over what is left) leaves the guard armed for the corrected amount', () => {
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => { h.result.current.selectDebtForPayFlow('d1'); h.result.current.setPaymentAmount('150') })
    h.act(() => h.result.current.handleAddPayment())
    expect(st().debtPayments).toHaveLength(0)
    h.act(() => h.result.current.setPaymentAmount('100'))
    h.act(() => h.result.current.handleAddPayment())
    expect(st().debtPayments).toHaveLength(1)
  })
})

describe('new installment plan (FRM-11)', () => {
  const setup = (count: string) => {
    useSettingsStore.setState({ activeModal: 'addDebt', debtSheetPaymentOnly: false } as never)
    const h = renderLite(() => useAddDebtSheet())
    h.act(() => {
      h.result.current.setMode('new'); h.result.current.setDebtType('installment'); h.result.current.setStartingBalance('100')
      h.result.current.setInstallmentItemName('Phone'); h.result.current.setInstallmentCount(count)
    })
    return h
  }
  it('an absurd count (999999999999) cannot be saved', () => {
    const h = setup('999999999999')
    expect(h.result.current.canSubmitNewDebt).toBe(false)
    h.act(() => h.result.current.handleAddDebt())
    expect(st().debts).toHaveLength(1)
  })
  it('a slice under one cent cannot be saved, a normal plan can', () => {
    expect(setup('601').result.current.canSubmitNewDebt).toBe(false)
    expect(setup('12').result.current.canSubmitNewDebt).toBe(true)
  })
  it('a double tap on Add creates one plan', () => {
    const h = setup('12')
    const frozen = h.result.current.handleAddDebt
    h.act(() => frozen())
    h.act(() => frozen())
    expect(st().debts.filter((d) => d.id !== 'd1')).toHaveLength(1)
  })
})
