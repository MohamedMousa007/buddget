import type { Currency, FinanceStore, GoalCategory, IncomeRecurringFrequency, IncomeSourceType } from '@/lib/store/types'
import { deriveDefaultPaydays, paydaysPerMonth } from '@/lib/utils/paydaySchedule'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import type { FactDebt, FactGoal } from '@/lib/budget/facts'
import { answeredDebts, answeredGoals } from '@/lib/budget/flow/toFacts'
import type { FlowState } from '@/lib/budget/flow/types'

export interface StudioEntityNames {
  income: string
  savings: string
  /** Display name for a debt the studio created, by its fact id (`answered-card`, `answered-loan`...). */
  debt: (factId: string) => string
  /** Display name for a goal kind. */
  goal: (kind: GoalCategory) => string
}

type Actions = Pick<FinanceStore, 'addIncomeSource' | 'addDebt' | 'addGoal' | 'addSavingsAccount' | 'goals' | 'incomeSources' | 'debts' | 'savingsAccounts'>

const DEFAULT_PAYDAY = 25
const MIN_INSTALMENT_MONTHS = 12
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const amountOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

const GOAL_OF_KIND: Record<string, GoalCategory> = {
  vacation: 'vacation', house: 'house', car: 'car', education: 'education', wedding: 'wedding', business: 'business', pilgrimage: 'custom', other: 'custom',
}
const SOURCE_OF_TYPE: Record<string, IncomeSourceType> = {
  salary: 'salary', freelance: 'side_hustle', business: 'side_hustle', seasonal: 'side_hustle', mixed: 'salary', benefits: 'other', allowance: 'other',
}

/** Ids of the debts and goals created from these answers, so the plan can use the richer fact (with its interest rate) instead of counting both. */
export const createdIds = (created: Record<string, string>): Set<string> =>
  new Set(Object.entries(created).filter(([k]) => k.startsWith('debt:') || k.startsWith('goal:')).map(([, id]) => id))

/**
 * Turns what the user told the studio into the real records the rest of the app reads, so the plan never
 * describes money Flow, Debts, Goals and Wealth cannot see. Returns the ids created now; a kind already
 * in `state.entities` is never created twice, so a retried or resumed build adds nothing. Nothing is created when the
 * app already holds that kind of record: what the user typed in words must not double what they already track.
 */
export function commitFlowEntities(state: FlowState, store: Actions, base: Currency, names: StudioEntityNames, now: Date = new Date()): Record<string, string> {
  const done = state.entities ?? {}
  const a = state.a
  const created: Record<string, string> = {}

  const income = amountOf(a.income)
  if (income > 0 && !done.income && store.incomeSources.length === 0) {
    const day = Math.min(31, Math.max(1, Math.round(Number(a.payday) || DEFAULT_PAYDAY)))
    // The answer is a monthly take-home; weekly and biweekly sources store the amount per paycheck.
    const frequency: IncomeRecurringFrequency = a.payFrequency === 'weekly' || a.payFrequency === 'biweekly' ? a.payFrequency : 'monthly'
    store.addIncomeSource({
      name: names.income, amount: Math.round((income / paydaysPerMonth(frequency)) * 100) / 100, currency: base, isRecurring: true, recurringFrequency: frequency,
      dayOfMonth: day, paydayDays: deriveDefaultPaydays(day, frequency), sourceType: SOURCE_OF_TYPE[String(a.incomeType)] ?? 'salary',
    })
    created.income = 'done'
  }

  const savings = amountOf(a.savingsOnHand)
  if (savings > 0 && !done.savings && store.savingsAccounts.length === 0) {
    created.savings = store.addSavingsAccount({
      name: names.savings, category: 'savings', type: 'bank', currency: base, openingBalance: savings, isEmergencyCover: true,
    })
  }

  if (store.debts.length === 0) {
    for (const d of answeredDebts(a).filter((x: FactDebt) => x.balance > 0 && !done[`debt:${x.id}`])) {
      const payment = d.minimum > 0 ? d.minimum : Math.ceil(d.balance / MIN_INSTALMENT_MONTHS)
      created[`debt:${d.id}`] = store.addDebt({
        name: names.debt(d.id), person: '', startingBalance: d.balance, currency: base, isGold: false, direction: 'i_owe',
        debtType: 'installment', installmentCount: Math.max(1, Math.ceil(d.balance / payment)), installmentFrequency: 'monthly',
        installmentAmount: payment, startDate: isoDay(now), interestFree: (d.apr ?? 0) === 0,
      })
    }
  }

  if (store.goals.length === 0) {
    const kind = GOAL_OF_KIND[String(a.goalKind)] ?? 'custom'
    let priority = 0
    for (const g of answeredGoals(a).filter((x: FactGoal) => x.targetAmount && x.targetAmount > 0 && !done[`goal:${x.id}`])) {
      const months = Math.max(1, Math.ceil((g.targetAmount as number) / Math.max(1, g.monthly)))
      const due = new Date(now.getFullYear(), now.getMonth() + months, now.getDate())
      const category: GoalCategory = g.id === 'answered-goal-1' ? kind : 'custom'
      created[`goal:${g.id}`] = store.addGoal({
        name: names.goal(category), emoji: GOAL_CATEGORIES.find((c) => c.value === category)?.emoji ?? '✏️', category, currency: base,
        targetAmount: g.targetAmount as number, targetDate: isoDay(due), monthlyContribution: g.monthly, fundingMode: 'fixed',
        frequency: 'monthly', monthlySpendingLimit: null, linkedSavingsAccountIds: [], linkedDebtIds: [], priority: priority++, status: 'active', notes: null,
      })
    }
  }
  return created
}
