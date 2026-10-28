import type { Currency, Expense, IncomeEvent, IncomeSource } from '@/lib/store/types'
import { actualIncomeForMonth, expenseAmountInBase } from '@/lib/utils/calculations'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { tryConvertCurrency } from '@/lib/utils/currency'

export interface CycleCarryInput {
  monthKey: string
  monthStartDay: number
  base: Currency
  rates: Record<string, number>
  expenses: Expense[]
  incomeEvents: IncomeEvent[]
  incomeSources: IncomeSource[]
  deposits: { amount: number; currency: string; kind: string; isCashFlow: boolean | null; source: string | null }[]
  /** Currencies the later carry steps convert (the destination pocket); they must be convertible too. */
  extraCurrencies?: string[]
}

export interface CycleCarryFigures {
  income: number
  spend: number
  allocated: number
}

type Deposit = CycleCarryInput['deposits'][number]
const isCountedDeposit = (t: Deposit) => t.kind === 'deposit' && t.isCashFlow !== false && t.source !== 'carry'

/** Same maths as the client's month figures: non-spend and refunded rows drop out, income falls back to the projection. */
export function cycleCarryFigures(i: CycleCarryInput): CycleCarryFigures | null {
  const currencies = new Set<string>([
    ...i.expenses.map((e) => e.currency),
    ...i.incomeEvents.map((e) => e.currency),
    ...i.incomeSources.map((s) => s.currency),
    ...i.deposits.filter(isCountedDeposit).map((d) => d.currency),
    ...(i.extraCurrencies ?? []),
  ])
  // Gold deposits (XAU grams) have no server-side gram quote: the cycle is skipped (null, logged) rather than priced wrong.
  for (const c of currencies) if (tryConvertCurrency(1, c, i.base, i.rates) === null) return null

  const inBase = (e: Expense) => expenseAmountInBase(e, i.base, i.rates)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

  const income = actualIncomeForMonth(i.incomeSources, i.incomeEvents, i.base, i.rates, i.monthKey, i.monthStartDay, true)
  const spend = sum(i.expenses.filter((e) => !isNonSpendExpense(e)).map(inBase))
  const savingsTagged = sum(i.expenses.filter((e) => e.category === 'Savings').map(inBase))
  // The carry's own sweep and goal-funding deposits are the carry itself: counting them would shrink a rerun.
  const deposited = sum(
    i.deposits
      .filter(isCountedDeposit)
      .map((t) => tryConvertCurrency(t.amount, t.currency, i.base, i.rates) ?? 0),
  )
  return { income, spend, allocated: savingsTagged + deposited }
}
