import { format, parseISO } from 'date-fns'
import { addByFrequency } from '@/lib/debts/installmentSchedule'
import { debtPaidAmountInCurrency } from '@/lib/goals/debtPaidInCurrency'
import type { GoalProgressContext } from '@/lib/goals/computeGoalProgress'
import type { Debt, DebtPayment, Goal, SavingsTransaction } from '@/lib/store/types'
import { calculateDebtRemaining, calculateDebtRemainingInBaseCurrency } from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'

/** Debts that a goal tracks. A debt goal never holds its own amounts: it reads these. */
export function linkedDebts(goal: Pick<Goal, 'linkedDebtIds'>, debts: Debt[]): Debt[] {
  return debts.filter((d) => goal.linkedDebtIds.includes(d.id))
}

/** Last scheduled payment of an installment plan, or the debt's own payoff goal date. */
export function debtEndDate(debt: Debt): string | null {
  if (debt.startDate && debt.installmentFrequency && (debt.installmentCount ?? 0) > 0) {
    return format(addByFrequency(parseISO(debt.startDate), debt.installmentFrequency, (debt.installmentCount as number) - 1), 'yyyy-MM-dd')
  }
  return debt.goal?.targetDate ?? null
}

/** Debt ids already followed by an active or paused debt goal, so a second goal is never created for them. */
export function trackedDebtIds(goals: Goal[], exceptGoalId?: string): Set<string> {
  return new Set(
    goals
      .filter((g) => g.category === 'debt_freedom' && g.status !== 'achieved' && g.id !== exceptGoalId)
      .flatMap((g) => g.linkedDebtIds),
  )
}

/**
 * Paid so far and the whole amount (paid + still owed), in the goal's currency, from the linked debts.
 * Null when the goal is not linked to a debt we can value (then the goal keeps its stored figures).
 */
export function debtGoalTotals(goal: Goal, ctx: GoalProgressContext): { paid: number; total: number } | null {
  const debts = linkedDebts(goal, ctx.debts).filter((d) => !d.isGold || ctx.goldPriceAvailable)
  if (goal.category !== 'debt_freedom' || debts.length === 0) return null
  const balanceCtx = { expenses: ctx.expenses, exchangeRates: ctx.exchangeRates, allDebts: ctx.debts }
  let paid = 0
  let owed = 0
  for (const d of debts) {
    paid += debtPaidAmountInCurrency(d, ctx.debtPayments, goal.currency, ctx.baseCurrency, ctx.exchangeRates, ctx.goldPricePerGram, ctx.goldPriceAvailable)
    const remaining = d.status === 'cleared' ? 0 : calculateDebtRemaining(d, ctx.debtPayments, balanceCtx)
    const inBase = calculateDebtRemainingInBaseCurrency(remaining, d, ctx.baseCurrency, ctx.exchangeRates, ctx.goldPricePerGram, ctx.goldPriceAvailable)
    owed += convertCurrency(inBase, ctx.baseCurrency, goal.currency, ctx.exchangeRates)
  }
  return { paid, total: paid + owed }
}

/**
 * The goal as the app should show it: for a debt goal the target and finish date come live from the
 * linked debts, so adding a charge, an installment or a payment never leaves the goal out of date.
 */
export function withDebtDerived(goal: Goal, ctx: GoalProgressContext): Goal {
  const totals = debtGoalTotals(goal, ctx)
  if (!totals) return goal
  const ends = linkedDebts(goal, ctx.debts).map(debtEndDate).filter((d): d is string => d !== null).sort()
  return { ...goal, targetAmount: totals.total, targetDate: ends.length ? ends[ends.length - 1] : goal.targetDate }
}

const PERIODS_PER_MONTH = { weekly: 4.345, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 } as const

/** What the linked installments ask per month, in the goal's currency; null when none has a schedule. */
export function debtMonthlyRate(goal: Goal, debts: Debt[], rates: Record<string, number>): number | null {
  const plans = linkedDebts(goal, debts).filter((d) => !d.isGold && d.installmentAmount && d.installmentFrequency)
  if (plans.length === 0) return null
  return plans.reduce(
    (sum, d) => sum + convertCurrency(d.installmentAmount as number, d.currency, goal.currency, rates) * PERIODS_PER_MONTH[d.installmentFrequency as keyof typeof PERIODS_PER_MONTH],
    0,
  )
}

/**
 * The ledger a goal's checkpoints are dated from: pocket deposits for a saving goal, the debts'
 * payments for a debt goal (shaped like deposits so one routine serves both).
 */
export function goalLedger(
  goal: Goal,
  s: { savingsTransactions: SavingsTransaction[]; debts: Debt[]; debtPayments: DebtPayment[] },
): { goal: Goal; txs: SavingsTransaction[] } {
  if (goal.category !== 'debt_freedom') return { goal, txs: s.savingsTransactions }
  const own = linkedDebts(goal, s.debts).filter((d) => !d.isGold)
  const txs = s.debtPayments
    .filter((p) => own.some((d) => d.id === p.debtId))
    .map((p): SavingsTransaction => ({
      id: p.id, accountId: 'debt-goal', type: 'deposit', amount: p.amountPaid,
      currency: own.find((d) => d.id === p.debtId)!.currency as SavingsTransaction['currency'], date: p.date,
    }))
  return { goal: { ...goal, linkedSavingsAccountIds: ['debt-goal'] }, txs }
}
