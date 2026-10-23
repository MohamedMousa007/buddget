import type { Currency, FinanceStore, GoalCategory } from '@/lib/store/types'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import type { StudioState } from '@/lib/budget/infoGaps'

export const GOAL_KINDS: readonly GoalCategory[] = ['vacation', 'house', 'car', 'education', 'wedding', 'custom']

export interface StudioEntityNames {
  income: string
  debt: string
  savings: string
  /** Display name for a goal kind. */
  goal: (kind: GoalCategory) => string
}

type Actions = Pick<FinanceStore, 'addIncomeSource' | 'addDebt' | 'addGoal' | 'addSavingsAccount' | 'goals'>

const DEFAULT_PAYDAY = 25
const DEFAULT_GOAL_MONTHS = 12
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const amountOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/**
 * Turns what the user told the studio into the real records the rest of the app reads, so the plan never
 * describes money Flow, Debts, Goals and Wealth cannot see. Returns the ids created now; a kind already
 * in `state.entities` is never created twice, so a retried or resumed build adds nothing.
 */
export function commitStudioEntities(
  state: StudioState,
  store: Actions,
  base: Currency,
  names: StudioEntityNames,
  now: Date = new Date(),
): Record<string, string> {
  const done = state.entities ?? {}
  const created: Record<string, string> = {}

  const income = amountOf(state.answers.income)
  if (income > 0 && !done.income) {
    const day = Math.min(31, Math.max(1, Math.round(Number(state.answers.payday) || DEFAULT_PAYDAY)))
    store.addIncomeSource({
      name: names.income, amount: income, currency: base, isRecurring: true, recurringFrequency: 'monthly',
      dayOfMonth: day, paydayDays: [day], sourceType: 'salary',
    })
    created.income = 'done'
  }

  const savings = amountOf(state.answers.savingsOnHand)
  if (savings > 0 && !done.savings) {
    created.savings = store.addSavingsAccount({
      name: names.savings, category: 'savings', type: 'bank', currency: base, openingBalance: savings, isEmergencyCover: true,
    })
  }

  const owed = amountOf(state.answers.debtTotal)
  const monthly = amountOf(state.answers.debtMonthly)
  if (state.answers.hasDebts === true && (owed > 0 || monthly > 0) && !done.debt) {
    const total = owed > 0 ? owed : monthly
    const payment = monthly > 0 ? monthly : total
    created.debt = store.addDebt({
      name: names.debt, person: '', startingBalance: total, currency: base, isGold: false, direction: 'i_owe',
      debtType: 'installment', installmentCount: Math.max(1, Math.ceil(total / payment)), installmentFrequency: 'monthly',
      installmentAmount: payment, startDate: isoDay(now), interestFree: true,
    })
  }

  const target = amountOf(state.answers.goalTarget)
  if (state.answers.hasGoal === true && target > 0 && !done.goal) {
    const months = Math.max(1, Math.round(Number(state.answers.goalMonths) || DEFAULT_GOAL_MONTHS))
    const kind = GOAL_KINDS.find((k) => k === state.answers.goalKind) ?? 'custom'
    const due = new Date(now.getFullYear(), now.getMonth() + months, now.getDate())
    created.goal = store.addGoal({
      name: names.goal(kind), emoji: GOAL_CATEGORIES.find((c) => c.value === kind)?.emoji ?? '✏️', category: kind, currency: base,
      targetAmount: target, targetDate: isoDay(due), monthlyContribution: Math.ceil(target / months), fundingMode: 'fixed',
      frequency: 'monthly', monthlySpendingLimit: null, linkedSavingsAccountIds: [], linkedDebtIds: [],
      priority: store.goals.reduce((m, g) => Math.max(m, g.priority + 1), 0), status: 'active', notes: null,
    })
  }
  return created
}
