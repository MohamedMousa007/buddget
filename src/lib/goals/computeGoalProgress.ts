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
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { expenseAmountInBase, filterExpensesByMonth } from '@/lib/utils/calculations'
import { partAmountInBase } from '@/lib/savings/savingsConversions'
import { coveredParts } from '@/lib/savings/shortfall'
import { ledgerOf } from '@/lib/savings/pocketHome'
import { goldPurityFactor } from '@/lib/utils/calculations'
import { debtPaidAmountInCurrency } from '@/lib/goals/debtPaidInCurrency'

export type GoalProgressContext = {
  savingsAccounts: SavingsAccount[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  expenses: Expense[]
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  /** The gold price is the last good one (the live fetch failed); progress still counts it, with a warning. */
  goldPriceStale?: boolean
  /** When that last good gold price was fetched. */
  lastGoldFetch?: string | null
  /** covered(p) per part id (§4.2): what a short account still holds of each part. Absent = every part counts whole. */
  covered?: ReadonlyMap<string, number>
  monthFilter: string
  monthStartDay: number
  baseCurrency: Currency
}

export interface GoalProgressDetail {
  amount: number
  /** A gold part was valued at the last good price (per gram, at that part's karat) fetched at `at`. */
  stalePrice: { perGram: number; at: string } | null
  /** A part with money could not be priced at all and counts 0 until prices load: gold, or another unit. */
  priceMissing: 'gold' | 'other' | null
}

/** The goal's parts (§4.5): `goal_id` is the goal, or the goal lists a row with no goal yet (a cached legacy row). */
export const partsOfGoal = (goal: Pick<Goal, 'id' | 'linkedSavingsAccountIds'>, accounts: readonly SavingsAccount[]): SavingsAccount[] =>
  accounts.filter((a) => a.goalId === goal.id || (!a.goalId && goal.linkedSavingsAccountIds.includes(a.id)))

/** progress(G) = Σ covered(p) over G's parts, each at live value (gold at its karat), in G's currency (I-6). */
function partsProgress(goal: Goal, parts: readonly SavingsAccount[], ctx: GoalProgressContext): GoalProgressDetail {
  let amount = 0
  let stalePrice: GoalProgressDetail['stalePrice'] = null
  let priceMissing: GoalProgressDetail['priceMissing'] = null
  for (const p of parts) {
    const own = ctx.covered?.get(p.id) ?? p.currentBalance
    if (!(own > 0)) continue
    const inBase = partAmountInBase(p, own, ctx.baseCurrency, ctx.exchangeRates, ctx.goldPricePerGram, ctx.goldPriceAvailable)
    if (inBase === null) {
      priceMissing = priceMissing === 'gold' || p.currency === 'XAU' ? 'gold' : 'other'
      continue
    }
    if (p.currency === 'XAU' && ctx.goldPriceStale && ctx.lastGoldFetch && !stalePrice) {
      stalePrice = { perGram: ctx.goldPricePerGram * goldPurityFactor(p.karat ?? 24), at: ctx.lastGoldFetch }
    }
    amount += convertCurrency(inBase, ctx.baseCurrency, goal.currency, ctx.exchangeRates)
  }
  return { amount, stalePrice, priceMissing }
}

/** Live progress amount for a goal (not persisted); see {@link computeGoalProgressDetail}. */
export function computeGoalProgress(goal: Goal, ctx: GoalProgressContext): number {
  return computeGoalProgressDetail(goal, ctx).amount
}

/**
 * Live progress for a goal with its price warnings: the goal's parts (covered amounts), linked debt payments,
 * the manual amount when it has no parts, or current-month spend for spending_control.
 */
export function computeGoalProgressDetail(goal: Goal, ctx: GoalProgressContext): GoalProgressDetail {
  const plain = (amount: number): GoalProgressDetail => ({ amount, stalePrice: null, priceMissing: null })
  if (goal.category !== 'debt_freedom' && goal.category !== 'spending_control') {
    const parts = partsOfGoal(goal, ctx.savingsAccounts)
    if (parts.length === 0 && goal.linkedSavingsAccountIds.length === 0) return plain(goal.manualCurrentAmount)
    return partsProgress(goal, parts, ctx)
  }
  return plain(otherProgress(goal, ctx))
}

function otherProgress(goal: Goal, ctx: GoalProgressContext): number {
  if (goal.category === 'debt_freedom') {
    const linked = ctx.debts.filter((d) => goal.linkedDebtIds.includes(d.id))
    if (linked.length === 0) return goal.manualCurrentAmount
    return linked.reduce((sum, d) => {
      const paid = debtPaidAmountInCurrency(
        d,
        ctx.debtPayments,
        goal.currency,
        ctx.baseCurrency,
        ctx.exchangeRates,
        ctx.goldPricePerGram,
        ctx.goldPriceAvailable
      )
      return sum + paid
    }, 0)
  }

  const monthExpenses = filterExpensesByMonth(
    ctx.expenses,
    ctx.monthFilter,
    ctx.monthStartDay
  ).filter((e) => !isNonSpendExpense(e) && (!goal.spendingCategory || e.category === goal.spendingCategory))
  const totalBase = monthExpenses.reduce(
    (s, e) => s + expenseAmountInBase(e, ctx.baseCurrency, ctx.exchangeRates),
    0
  )
  return convertCurrency(totalBase, ctx.baseCurrency, goal.currency, ctx.exchangeRates)
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
  | 'goldPriceStale'
  | 'lastGoldFetch'
  | 'settings'
  | 'goals'
  | 'paymentMethods'
  | 'incomeEvents'
  | 'savingsTransactions'
  | 'accountAdjustments'
>

/** covered(p) only when a goal has a part inside an account; otherwise nothing can be short and the ledger walk is skipped. */
function goalCoverage(slice: GoalProgressStoreSlice): ReadonlyMap<string, number> | undefined {
  const listed = new Set(slice.goals.flatMap((g) => g.linkedSavingsAccountIds))
  const held = slice.savingsAccounts.some((p) => p.heldInPaymentMethodId && (p.goalId || listed.has(p.id)))
  return held ? coveredParts(ledgerOf(slice), slice.goals) : undefined
}

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
    goldPriceStale: slice.goldPriceStale,
    lastGoldFetch: slice.lastGoldFetch,
    covered: goalCoverage(slice),
    monthFilter,
    monthStartDay: slice.settings.monthStartDay,
    baseCurrency: slice.settings.baseCurrency,
  }
}
