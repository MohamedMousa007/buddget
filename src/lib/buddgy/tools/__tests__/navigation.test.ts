import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import { ALL_SPECS } from '@/lib/buddgy/tools/specs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { navigate } from '@/lib/navigation/navigate'
import { isShellPath } from '@/lib/navigation/shellRoutes'
import { SETTINGS_REGISTRY } from '@/lib/settings/registry'
import type { Debt, IncomeEvent, PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const nav = (name: string, args: Record<string, unknown> = {}) => TOOLS.get(name)!.nav!(args, ctx)
const modal = () => useSettingsStore.getState()

const CASH = 'a1a1a1a1-0000-0000-0000-000000000001'
const CARD = 'b2b2b2b2-0000-0000-0000-000000000002'
const DEBT = 'c3c3c3c3-0000-0000-0000-000000000003'
const EVENT = 'd4d4d4d4-0000-0000-0000-000000000004'

beforeEach(() => {
  vi.mocked(navigate).mockClear()
  useSettingsStore.setState({ activeModal: null, expensePrefill: null, pmPrefill: null, paydayPrefill: null, assignTarget: null, settingsFocusId: null, debtSheetPrefillDebtId: null })
  useFinanceStore.setState({
    paymentMethods: [
      { id: CASH, name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true } as PaymentMethod,
      { id: CARD, name: 'CIB Card', type: 'debit_card', currency: 'EGP', isDefault: false } as PaymentMethod,
    ],
    debts: [{ id: DEBT, name: 'Car loan' } as Debt],
    incomeEvents: [{ id: EVENT, name: 'Bonus' } as IncomeEvent],
    budgetPlans: [],
    activeBudgetPlanId: null,
  })
})

describe('navigation tool wiring', () => {
  it('registers three immediate nav tools with unique names across all domains', () => {
    expect(['open_screen', 'open_setting', 'open_sheet'].map((n) => TOOLS.get(n)?.spec.kind)).toEqual(['nav', 'nav', 'nav'])
    const names = ALL_SPECS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('open_screen', () => {
  it('navigates to real shell routes only', async () => {
    const { SCREEN_ROUTES } = await import('@/lib/buddgy/tools/specs/navigation')
    for (const route of Object.values(SCREEN_ROUTES)) expect(isShellPath(route)).toBe(true)
    expect(Object.values(SCREEN_ROUTES).some((r) => r.includes('admin'))).toBe(false)
    expect(nav('open_screen', { screen: 'budget' })).toMatchObject({ ok: true })
    expect(navigate).toHaveBeenCalledWith('/budget-setup')
  })

  it('refuses unknown screens including admin', () => {
    expect(nav('open_screen', { screen: 'admin' }).ok).toBe(false)
    expect(nav('open_screen', { screen: '/admin' }).ok).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('open_setting', () => {
  it('navigates to the settings page and asks it to highlight the row', () => {
    expect(nav('open_setting', { setting: 'payCycle' }).ok).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/settings/money')
    expect(modal().settingsFocusId).toBe('payCycle')
  })

  it('opens sheet-backed settings as modals instead', () => {
    nav('open_setting', { setting: 'paymentMethods' })
    expect(modal().activeModal).toBe('paymentMethods')
    nav('open_setting', { setting: 'household' })
    expect(modal().activeModal).toBe('householdRent')
    nav('open_setting', { setting: 'lifestyle' })
    expect(modal().activeModal).toBe('lifestyle')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not run the reset-tips action and offers every non-destructive setting', () => {
    useSettingsStore.setState({ dismissedBanners: ['x'] })
    nav('open_setting', { setting: 'resetTips' })
    expect(modal().dismissedBanners).toEqual(['x'])
    expect(navigate).toHaveBeenCalledWith('/settings/data')
    const spec = TOOLS.get('open_setting')!.spec.params.properties!.setting.enum!
    expect(spec).toEqual(SETTINGS_REGISTRY.filter((s) => s.kind !== 'danger').map((s) => s.id))
    expect(spec).not.toContain('deleteAccount')
    expect(spec).not.toContain('startFresh')
  })

  it('refuses destructive and unknown settings', () => {
    expect(nav('open_setting', { setting: 'deleteAccount' }).ok).toBe(false)
    expect(nav('open_setting', { setting: 'nope' }).ok).toBe(false)
  })
})

describe('open_sheet', () => {
  it('opens the expense form with a resolved prefill', () => {
    const r = nav('open_sheet', { sheet: 'add_expense', name: 'Coffee', amount: 45, currency: 'egp', category: 'food', date: '2026-10-18', method: 'cib card', notes: 'x' })
    expect(r.ok).toBe(true)
    expect(modal().activeModal).toBe('addExpense')
    expect(modal().expensePrefill).toEqual({ description: 'Coffee', amount: '45', currency: 'EGP', category: 'Food', date: '2026-10-18', paymentMethod: 'CIB Card', notes: 'x' })
  })

  it('opens an empty expense form and validates the prefill instead of guessing', () => {
    expect(nav('open_sheet', { sheet: 'add_expense' }).ok).toBe(true)
    expect(modal().expensePrefill).toEqual({})
    useSettingsStore.setState({ activeModal: null })
    for (const bad of [{ amount: 0 }, { amount: 'x' }, { currency: 'XXX' }, { date: '2026-02-31' }, { category: 'Nonsense' }, { method: 'Amex' }]) {
      const r = nav('open_sheet', { sheet: 'add_expense', ...bad })
      expect(r.ok).toBe(false)
    }
    expect(modal().activeModal).toBeNull()
    expect(nav('open_sheet', { sheet: 'add_expense', method: 'Amex' }).message).toMatch(/Options: Cash, CIB Card/)
  })

  it('opens the payment method form', () => {
    expect(nav('open_sheet', { sheet: 'add_payment_method', name: 'HSBC', last4: '1234', type: 'credit_card' }).ok).toBe(true)
    expect(modal().activeModal).toBe('addPaymentMethod')
    expect(modal().pmPrefill).toEqual({ name: 'HSBC', last4: '1234', type: 'credit_card' })
    expect(nav('open_sheet', { sheet: 'add_payment_method' }).ok).toBe(false)
    expect(nav('open_sheet', { sheet: 'add_payment_method', name: 'HSBC', last4: '12' }).ok).toBe(false)
    expect(nav('open_sheet', { sheet: 'add_payment_method', name: 'HSBC', type: 'piggy' }).ok).toBe(false)
  })

  it('opens the new payday form with a prefill', () => {
    expect(nav('open_sheet', { sheet: 'new_payday', name: 'Salary', amount: 20000, currency: 'EGP', type: 'salary', day: 25, method: refOf(CARD) }).ok).toBe(true)
    expect(modal().activeModal).toBe('addPayday')
    expect(modal().paydayPrefill).toEqual({ name: 'Salary', amount: 20000, currency: 'EGP', sourceType: 'salary', dayOfMonth: 25, paymentMethodId: CARD })
    expect(nav('open_sheet', { sheet: 'new_payday', day: 40 }).ok).toBe(false)
    expect(nav('open_sheet', { sheet: 'new_payday', type: 'lottery' }).ok).toBe(false)
  })

  it('opens the assign income sheet for a general or a specific entry', () => {
    nav('open_sheet', { sheet: 'assign_income' })
    expect(modal().assignTarget).toEqual({ eventId: null })
    nav('open_sheet', { sheet: 'assign_income', ref: 'Bonus' })
    expect(modal().assignTarget).toEqual({ eventId: EVENT })
    expect(nav('open_sheet', { sheet: 'assign_income', ref: 'Ghost' }).ok).toBe(false)
  })

  it('opens the debt sheets', () => {
    nav('open_sheet', { sheet: 'add_debt', family: 'installment' })
    expect(modal()).toMatchObject({ activeModal: 'addDebt', debtSheetPresetFamily: 'installment', debtSheetPaymentOnly: false })
    nav('open_sheet', { sheet: 'pay_debt' })
    expect(modal().activeModal).toBe('payDebt')
    expect(nav('open_sheet', { sheet: 'record_debt_payment', ref: 'car loan' }).ok).toBe(true)
    expect(modal()).toMatchObject({ activeModal: 'addDebt', debtSheetPaymentOnly: true, debtSheetPrefillDebtId: DEBT })
    const none = nav('open_sheet', { sheet: 'record_debt_payment', ref: 'House' })
    expect(none.ok).toBe(false)
    expect(none.message).toContain(refOf(DEBT))
  })

  it('refuses unknown sheets', () => {
    expect(nav('open_sheet', { sheet: 'delete_everything' }).ok).toBe(false)
    expect(modal().activeModal).toBeNull()
  })
})
