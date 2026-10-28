import { beforeEach, describe, expect, it } from 'vitest'
import { buildAIActionHandlerContext, describeActionTarget, executeActionItem, validateActionItem } from '@/lib/ai/aiActionHandlers'
import { friendlyLineForActionItem } from '@/lib/ai/gemini'
import { checkDate } from '@/lib/ai/legacyGuards'
import type { Debt, Expense } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { localTodayISO } from '@/lib/utils/localDate'

const exp = (id: string, description: string, amount: number, createdAt: string): Expense =>
  ({ id, date: '2026-10-10', description, category: 'Food', amount, currency: 'EGP', amountInBaseCurrency: amount, paymentMethodId: '', isRecurring: false, createdAt, updatedAt: createdAt }) as Expense

const debt = (id: string, name: string, person: string): Debt =>
  ({ id, name, person, currency: 'EGP', startingBalance: 1000, direction: 'i_owe', status: 'active', debtType: 'personal', isGold: false }) as unknown as Debt

const ctx = () => buildAIActionHandlerContext(useFinanceStore.getState())

beforeEach(() => {
  useFinanceStore.setState({
    expenses: [exp('e1', 'Coffee', 30, '2026-10-10T10:00:00Z'), exp('e2', 'Coffee beans', 400, '2026-10-11T10:00:00Z'), exp('e3', '', 5, '2026-10-12T10:00:00Z')],
    debts: [debt('d1', 'Car loan', 'Ahmed'), debt('d2', 'Phone', 'Sara')],
    debtPayments: [],
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('legacy update_expense (I6)', () => {
  it('keeps the real description and ignores a rename to the hint', () => {
    executeActionItem(ctx(), 'update_expense', { description: 'coffee beans', newAmount: 450 })
    const e = useFinanceStore.getState().expenses.find((x) => x.id === 'e2')!
    expect(e.description).toBe('Coffee beans')
    expect(e.amount).toBe(450)
  })

  it('renames only through newDescription', () => {
    executeActionItem(ctx(), 'update_expense', { description: 'coffee beans', newDescription: 'Beans' })
    expect(useFinanceStore.getState().expenses.find((x) => x.id === 'e2')!.description).toBe('Beans')
  })

  it('rejects NaN, negative, zero and unknown or non-spend categories', () => {
    for (const bad of [{ newAmount: 'abc' }, { newAmount: -5 }, { newAmount: 0 }, { newCategory: 'Nonsense' }, { newCategory: 'Savings' }, {}]) {
      expect(validateActionItem(ctx(), 'update_expense', { description: 'coffee beans', ...bad })).toBeTruthy()
    }
    expect(validateActionItem(ctx(), 'update_expense', { description: 'coffee beans', newAmount: 10, newCategory: 'Food' })).toBeNull()
  })
})

describe('legacy fuzzy targets (I7)', () => {
  it('does not match anything for an empty hint, including an expense with an empty description', () => {
    expect(validateActionItem(ctx(), 'delete_expense', { description: ' ' })).toBeTruthy()
    expect(validateActionItem(ctx(), 'add_debt_payment', { amount: 500 })).toBeTruthy()
    executeActionItem(ctx(), 'add_debt_payment', { amount: 500 })
    expect(useFinanceStore.getState().debtPayments).toHaveLength(0)
  })

  it('prefers an exact name over a longer partial one', () => {
    expect(validateActionItem(ctx(), 'delete_expense', { description: 'coffee' })).toBeNull()
    executeActionItem(ctx(), 'delete_expense', { description: 'coffee' })
    expect(useFinanceStore.getState().expenses.map((e) => e.id)).toEqual(['e2', 'e3'])
  })

  it('asks which one when several partial matches remain', () => {
    useFinanceStore.setState({ expenses: [exp('e1', 'Coffee beans', 400, '2026-10-10T10:00:00Z'), exp('e2', 'Coffee shop', 30, '2026-10-11T10:00:00Z')] })
    const err = validateActionItem(ctx(), 'delete_expense', { description: 'coffee' })
    expect(err).toMatch(/several/)
    expect(err).toContain('Coffee beans')
    expect(err).toContain('Coffee shop')
    executeActionItem(ctx(), 'delete_expense', { description: 'coffee' })
    expect(useFinanceStore.getState().expenses).toHaveLength(2)
  })

  it('names the matched record in the confirmation line', () => {
    const target = describeActionTarget(ctx(), 'delete_expense', { description: 'beans' })
    expect(target).toContain('Coffee beans')
    expect(friendlyLineForActionItem('delete_expense', { description: 'beans' }, target)).toContain('Coffee beans (EGP 400')
    expect(describeActionTarget(ctx(), 'delete_debt', { name: 'sara' })).toBe('Phone (Sara)')
  })
})

describe('legacy amount and date bounds (I8)', () => {
  it('rejects absurd amounts and impossible or far dates on add_expense', () => {
    const today = localTodayISO()
    for (const bad of [{ amount: 1e15 }, { amount: 5, date: 'next friday' }, { amount: 5, date: '2026-13-45' }, { amount: 5, date: '2019-01-01' }, { amount: 5, date: '2099-01-01' }]) {
      expect(validateActionItem(ctx(), 'add_expense', { description: 'x', ...bad })).toBeTruthy()
    }
    expect(validateActionItem(ctx(), 'add_expense', { description: 'x', amount: 5, date: today })).toBeNull()
    expect(validateActionItem(ctx(), 'add_expense', { description: 'x', amount: 5 })).toBeNull()
  })

  it('applies the same bounds to add_debt_payment', () => {
    expect(validateActionItem(ctx(), 'add_debt_payment', { person: 'Ahmed', amount: 1e15 })).toBeTruthy()
    expect(validateActionItem(ctx(), 'add_debt_payment', { person: 'Ahmed', amount: 10, date: '2019-01-01' })).toBeTruthy()
    expect(validateActionItem(ctx(), 'add_debt_payment', { person: 'Ahmed', amount: 10 })).toBeNull()
  })

  it('windows the date around today', () => {
    const now = new Date('2026-10-19T12:00:00')
    expect(checkDate('2026-08-18', now)).toBeNull()
    expect(checkDate('2026-08-17', now)).toBeTruthy()
    expect(checkDate('2026-10-26', now)).toBeNull()
    expect(checkDate('2026-10-27', now)).toBeTruthy()
  })
})
