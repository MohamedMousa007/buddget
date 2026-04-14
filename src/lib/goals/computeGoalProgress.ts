import type {
  Currency,
  Debt,
  DebtPayment,
  Expense,
  FinanceStore,
  Goal,
  SavingsAccount,
} from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'
import { debtPaidAmountInCurrency } from '@/lib/goals/debtPaidInCurrency'

export type GoalProgressContext = {
  savingsAccounts: SavingsAccount[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  expenses: Expense[]
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  monthFilter: string
  monthStartDay: number
  baseCurrency: Currency
}

/**
 * Live progress amount for a goal (not persisted). Uses linked savings balances,
 * linked debt payments, manual amount, or current-month spend for spending_control.
 */
export function computeGoalProgress(goal: Goal, ctx: GoalProgressContext): number {
  if (goal.category === 'debt_freedom') {
    const linked = ctx.debts.filter((d) => goal.linkedDebtIds.includes(d.id))
    if (linked.length === 0) return goal.manualCurrentAmount
    return linked.reduce((sum, d) => {
      const paid = debtPaidAmountInCurrency(
        d,
        ctx.debtPayments,
        goal.currency,
        ctx.exchangeRates,
        ctx.goldPricePerGram,
        ctx.goldPriceAvailable
      )
      return sum + paid
    }, 0)
  }

  if (goal.category === 'spending_control') {
    const monthExpenses = filterExpensesByMonth(
      ctx.expenses,
      ctx.monthFilter,
      ctx.monthStartDay
    )
    const totalBase = monthExpenses.reduce(
      (s, e) => s + expenseAmountInBase(e, ctx.baseCurrency, ctx.exchangeRates),
      0
    )
    return convertCurrency(totalBase, ctx.baseCurrency, goal.currency, ctx.exchangeRates)
  }

  if (goal.linkedSavingsAccountIds.length === 0) {
    return goal.manualCurrentAmount
  }

  const linked = ctx.savingsAccounts.filter((a) => goal.linkedSavingsAccountIds.includes(a.id))
  return linked.reduce((sum, a) => {
    return sum + convertCurrency(a.currentBalance, a.currency, goal.currency, ctx.exchangeRates)
  }, 0)
}

type GoalProgressStoreSlice = Pick<
  FinanceStore,
  | 'savingsAccounts'
  | 'debts'
  | 'debtPayments'
  | 'expenses'
  | 'exchangeRates'
  | 'goldPricePerGram'
  | 'goldPriceAvailable'
  | 'settings'
>

export function buildGoalProgressContext(
  slice: GoalProgressStoreSlice,
  monthFilter: string
): GoalProgressContext {
  return {
    savingsAccounts: slice.savingsAccounts,
    debts: slice.debts,
    debtPayments: slice.debtPayments,
    expenses: slice.expenses,
    exchangeRates: slice.exchangeRates,
    goldPricePerGram: slice.goldPricePerGram,
    goldPriceAvailable: slice.goldPriceAvailable,
    monthFilter,
    monthStartDay: slice.settings.monthStartDay,
    baseCurrency: slice.settings.baseCurrency,
  }
}
