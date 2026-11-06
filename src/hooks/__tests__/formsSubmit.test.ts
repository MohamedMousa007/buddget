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
vi.mock('@/lib/i18n', () => ({
  useT: () => ({
    common: { tryAgain: 'Try again', toastExpenseLogged: 'ok' }, moneyFlows: {}, expenses: {},
    catalogs: { goalNames: {}, creditCardGoalName: 'Card', goalPocketName: (n: string) => `Pocket ${n}` },
  }),
}))
vi.mock('@/hooks/usePlanCategories', () => ({ usePlanCategories: () => ({ categoryChipOptions: [], defaultCategory: 'Food' }) }))
vi.mock('@/components/ui/ActionToast', () => ({ useActionToast: () => vi.fn() }))

import { cleanupLite, renderLite } from './liteReact'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useAddExpenseSheet } from '@/hooks/useAddExpenseSheet'
import { useEditExpenseForm } from '@/hooks/useEditExpenseForm'
import { useNewGoalForm } from '@/hooks/useNewGoalForm'
import { useAddSubscriptionForm } from '@/hooks/useAddSubscriptionForm'
import { useTypedAmount } from '@/hooks/useTypedAmount'
import { sanitizeAmount } from '@/lib/ui/amountSanitize'
import { nextValue } from '@/components/ui/NumberPad'

const pm = { id: 'pm1', name: 'Cash', type: 'cash', isDefault: true } as never
const rows = () => useFinanceStore.getState().expenses

afterEach(cleanupLite)

beforeEach(() => {
  const s = useFinanceStore.getState()
  useFinanceStore.setState({
    expenses: [], goals: [], savingsAccounts: [], subscriptions: [], paymentMethods: [pm],
    settings: { ...s.settings, baseCurrency: 'EGP', showSecondaryCurrency: false, showAllCurrenciesInForms: true },
  })
  useSettingsStore.setState({ activeModal: 'addExpense', expensePrefill: null } as never)
})

describe('a second Save from the same open sheet writes nothing (FRM-4, FRM-5)', () => {
  it('add expense: the stale handler an exiting sheet still holds is refused', () => {
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => { h.result.current.setAmount('5'); h.result.current.setDescription('x') })
    const frozen = h.result.current.handleSubmit
    h.act(() => frozen())
    h.act(() => frozen())
    expect(rows()).toHaveLength(1)
  })
  it('add expense: re-opening the sheet re-arms Save', () => {
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => { h.result.current.setAmount('5'); h.result.current.setDescription('x') })
    h.act(() => h.result.current.handleSubmit())
    h.act(() => useSettingsStore.setState({ activeModal: 'addExpense' } as never))
    h.act(() => { h.result.current.setAmount('7'); h.result.current.setDescription('y') })
    h.act(() => h.result.current.handleSubmit())
    expect(rows().map((e) => e.amount)).toEqual([5, 7])
  })
  it('add expense: a refused Save (blank description) does not arm the guard', () => {
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => { h.result.current.setAmount('5'); h.result.current.setDescription('   ') })
    h.act(() => h.result.current.handleSubmit())
    h.act(() => h.result.current.setDescription('x'))
    h.act(() => h.result.current.handleSubmit())
    expect(rows()).toHaveLength(1)
    expect(rows()[0].description).toBe('x')
  })
  it('edit expense: double Save writes once', () => {
    const e = { id: 'e1', date: '2026-10-01', description: 'H', category: 'Food', amount: 20, currency: 'EGP', amountInBaseCurrency: 20, paymentMethodId: 'pm1', isRecurring: false, createdAt: '', updatedAt: '' } as never
    useFinanceStore.setState({ expenses: [e] })
    const onClose = vi.fn()
    const h = renderLite(() => useEditExpenseForm(e, onClose))
    h.act(() => h.result.current.setAmount('25'))
    const save = h.result.current.handleSubmit
    h.act(() => save())
    h.act(() => save())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('subscription: a second Save adds no second subscription', () => {
    const onClose = vi.fn()
    const h = renderLite(() => useAddSubscriptionForm(null, onClose, null))
    h.act(() => h.result.current.patch({ name: 'X', amount: 10 }))
    h.act(() => h.result.current.submit())
    h.act(() => h.result.current.submit())
    expect(useFinanceStore.getState().subscriptions).toHaveLength(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('new goal: a second Create makes one goal, one pocket, one opening deposit', () => {
    const done = vi.fn()
    const h = renderLite(() => useNewGoalForm({ category: 'custom' } as never, done))
    h.act(() => { h.result.current.setName('Car'); h.result.current.setTargetAmount('1000'); h.result.current.setAlreadySaved('300') })
    const submit = h.result.current.submit
    h.act(() => submit())
    h.act(() => h.result.current.submit())
    const st = useFinanceStore.getState()
    expect(st.goals).toHaveLength(1)
    expect(st.savingsAccounts).toHaveLength(1)
    expect(done).toHaveBeenCalledTimes(1)
  })
})

describe('amount entry on the expense sheet (FRM-9, FRM-10, FRM-12)', () => {
  it('3-decimal text does not outlive a switch from KWD to EGP', () => {
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => { h.result.current.setCurrency('KWD' as never); h.result.current.setAmount('1.234'); h.result.current.setDescription('x') })
    h.act(() => h.result.current.setCurrency('EGP' as never))
    expect(h.result.current.amount).toBe('1.23')
    h.act(() => h.result.current.handleSubmit())
    expect(rows()[0].amount).toBe(1.23)
  })
  it('a prefilled amount goes through the parser: grouped digits, rounding to the currency', () => {
    useSettingsStore.setState({ expensePrefill: { amount: '1,250.50', description: 'x', currency: 'EGP' } } as never)
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => h.result.current.handleSubmit())
    expect(rows()[0]?.amount).toBe(1250.5)
  })
  it('an out-of-range prefill (1e+21) never reaches the ledger', () => {
    useSettingsStore.setState({ expensePrefill: { amount: '1e+21', description: 'x', currency: 'EGP' } } as never)
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => h.result.current.handleSubmit())
    expect(rows()).toHaveLength(0)
  })
  it('a 4-decimal prefill is rounded to the currency', () => {
    useSettingsStore.setState({ expensePrefill: { amount: '12.3456', description: 'x', currency: 'EGP' } } as never)
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => h.result.current.handleSubmit())
    expect(rows()[0]?.amount).toBe(12.35)
  })
  it('the description is saved trimmed', () => {
    const h = renderLite(() => useAddExpenseSheet())
    h.act(() => { h.result.current.setAmount('5'); h.result.current.setDescription('  Coffee  ') })
    h.act(() => h.result.current.handleSubmit())
    expect(rows()[0].description).toBe('Coffee')
  })
})

describe('typing a decimal into a box whose number is stored as a Number (FRM-1, FRM-2, FRM-3)', () => {
  // The exact expressions AddConfigureStep uses for its amount box.
  const sub = () =>
    renderLite(() => {
      const f = useAddSubscriptionForm(null, () => {}, null)
      const [text, setText] = useTypedAmount(f.draft.amount)
      return { f, text, setText }
    })
  const type = (h: ReturnType<typeof sub>, keys: string[], step: (shown: string, k: string) => string) => {
    for (const k of keys) {
      const next = step(h.result.current.text, k)
      h.act(() => {
        h.result.current.setText(next)
        h.result.current.f.patch({ amount: Number.parseFloat(next.replace(',', '.')) || 0 })
      })
    }
  }
  it('web keyboard: 9.99 stays 9.99', () => {
    const h = sub()
    type(h, [...'9.99'], (shown, ch) => sanitizeAmount(shown + ch))
    expect(h.result.current.f.draft.amount).toBe(9.99)
    expect(h.result.current.text).toBe('9.99')
  })
  it('native pad: 0 . 5 stays 0.5', () => {
    const h = sub()
    type(h, ['0', '.', '5'], (shown, k) => nextValue(shown, k, 'decimal'))
    expect(h.result.current.f.draft.amount).toBe(0.5)
  })
  it('the text follows the stored number when something else changes it (a plan pick)', () => {
    const h = sub()
    type(h, [...'12.'], (shown, ch) => sanitizeAmount(shown + ch))
    expect(h.result.current.text).toBe('12.')
    h.act(() => h.result.current.f.patch({ amount: 40 }))
    expect(h.result.current.text).toBe('40')
  })
})
