import type { BudgetPlan, Currency, Debt, UserProfile } from '@/lib/store/types'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'
import { convertCurrency } from '@/lib/utils/currency'

/**
 * "A simple month" (§4): rent, food, transport, bills, debt minimums — deliberately NOT the full
 * budget. Rent comes from the profile; food/transport/bills from the active plan's matching
 * categories; debt minimums from each debt's minimum payment. All in base currency.
 */
export interface SimpleMonth {
  rent: number
  food: number
  transport: number
  bills: number
  debtMinimums: number
  total: number
}

const MATCHERS: Record<Exclude<keyof SimpleMonth, 'total' | 'rent' | 'debtMinimums'>, string[]> = {
  food: ['food', 'groceries', 'dining'],
  transport: ['transport', 'fuel', 'car', 'commute'],
  bills: ['bills', 'utilities', 'electricity', 'internet', 'phone'],
}

function planCategorySum(plan: BudgetPlan | undefined, names: string[], base: Currency, rates: Record<string, number>): number {
  if (!plan) return 0
  return plan.categories.reduce((sum, c) => {
    const n = c.name.trim().toLowerCase()
    return names.some((m) => n.includes(m)) ? sum + effectivePlanCategoryAmountInBase(c, base, rates) : sum
  }, 0)
}

export function deriveSimpleMonth(params: {
  profile: UserProfile
  activePlan: BudgetPlan | undefined
  debts: Debt[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  /** Manual override — when set, its value is the whole "simple month" and the breakdown is proportional. */
  override?: number | null
}): SimpleMonth {
  const { profile, activePlan, debts, baseCurrency, exchangeRates } = params
  const rent = Math.max(0, Number(profile.monthlyRent) || 0)
  const food = planCategorySum(activePlan, MATCHERS.food, baseCurrency, exchangeRates)
  const transport = planCategorySum(activePlan, MATCHERS.transport, baseCurrency, exchangeRates)
  const bills = planCategorySum(activePlan, MATCHERS.bills, baseCurrency, exchangeRates)
  // Concrete scheduled monthly payments (installments); percent-of-balance minimums need the live
  // remaining balance and are left out of this simple estimate.
  const debtMinimums = debts.reduce((sum, d) => {
    const min = Number(d.installmentAmount ?? 0) || 0
    return sum + (min > 0 ? convertCurrency(min, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates) : 0)
  }, 0)
  const derivedTotal = rent + food + transport + bills + debtMinimums

  if (params.override != null && params.override > 0) {
    const t = params.override
    const scale = derivedTotal > 0 ? t / derivedTotal : 0
    return { rent: rent * scale, food: food * scale, transport: transport * scale, bills: bills * scale, debtMinimums: debtMinimums * scale, total: t }
  }
  return { rent, food, transport, bills, debtMinimums, total: derivedTotal }
}

/** A line of the simple month the user can count or leave out. */
export type SimpleMonthLine = Exclude<keyof SimpleMonth, 'total'>
export const SIMPLE_MONTH_LINES: readonly SimpleMonthLine[] = ['rent', 'food', 'transport', 'bills', 'debtMinimums']

/** The simple month with the lines in `off` left out. */
export function simpleMonthSum(month: SimpleMonth, off: ReadonlySet<SimpleMonthLine>): number {
  return SIMPLE_MONTH_LINES.reduce((sum, k) => (off.has(k) ? sum : sum + month[k]), 0)
}

/** The debts behind "Debt minimums", each with its monthly instalment in base currency, largest first. */
export function simpleMonthDebts(debts: Debt[], baseCurrency: Currency, exchangeRates: Record<string, number>): Array<{ name: string; amount: number }> {
  return debts
    .map((d) => {
      const min = Number(d.installmentAmount ?? 0) || 0
      return { name: d.name, amount: min > 0 ? convertCurrency(min, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates) : 0 }
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}
