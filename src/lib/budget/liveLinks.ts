import { format } from 'date-fns'
import type {
  Currency,
  Debt,
  DebtPayment,
  Expense,
  Goal,
  GoalCategory,
  IncomeSource,
  SavingsAccount,
  Subscription,
} from '@/lib/store/types'
import type { FactDebt } from '@/lib/budget/facts'
import type { DebtExtras, GoalExtras, SubscriptionItem, SubscriptionsExtras } from '@/lib/budget/planView.types'
import type { GoalStatusView } from '@/lib/goals/goalStatus'
import { minimumPaymentAmount } from '@/lib/debt/computeCreditCardBalance'
import { sourcePaydayDays } from '@/lib/utils/paydaySchedule'
import { chargeAmount, chargesLeftThisMonth, forecastCharges, isCharging, yearlySetAside } from '@/lib/subscriptions/subscriptionForecast'
import { subscriptionToMonthlyPlannerAmount } from '@/lib/subscriptions/subscriptionRecurring'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { computeGoalProgress, type GoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'
import {
  calculateDebtRemaining,
  calculateDebtRemainingInBaseCurrency,
  filterDebtPaymentsByMonth,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'

const WEEKS_PER_MONTH = 52 / 12

export function monthlyFromFrequency(amount: number, frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'): number {
  switch (frequency) {
    case 'weekly': return amount * WEEKS_PER_MONTH
    case 'quarterly': return amount / 3
    case 'annually': return amount / 12
    default: return amount
  }
}

/* Subscriptions */

export interface SubscriptionsLive {
  /** Monthly-equivalent total of everything that still bills (yearly plans at 1/12), base. */
  monthly: number
  count: number
  items: SubscriptionItem[]
}

export function subscriptionsLive(subs: Subscription[], base: Currency, rates: Record<string, number>, today: Date): SubscriptionsLive {
  const items = subs
    .filter((s) => isCharging(s, today))
    .map((s) => ({
      id: s.id,
      name: s.name,
      brandKey: s.brandKey,
      amount: convertCurrency(subscriptionToMonthlyPlannerAmount(chargeAmount(s), s.billingCycle), s.currency, base, rates),
    }))
  return { monthly: items.reduce((sum, i) => sum + i.amount, 0), count: items.length, items }
}

export interface SubscriptionsExtrasInput {
  subs: Subscription[]
  /** Every expense in the selected cycle. */
  cycleExpenses: Expense[]
  today: Date
  cycleStart: Date
  cycleEnd: Date
  base: Currency
  rates: Record<string, number>
}

/** Charges posted, charges to come and the next one. "To come" only exists while the cycle is the current one. */
export function subscriptionsExtras(i: SubscriptionsExtrasInput): SubscriptionsExtras {
  const live = subscriptionsLive(i.subs, i.base, i.rates, i.today)
  const current = i.today >= i.cycleStart && i.today <= i.cycleEnd
  const toRow = (name: string, due: Date, amount: number) => ({ name, date: format(due, 'yyyy-MM-dd'), amount })
  const left = current
    ? chargesLeftThisMonth(i.subs, i.cycleExpenses, i.today, i.base, i.rates)
        .filter((c) => c.due <= i.cycleEnd)
        .map((c) => toRow(c.sub.name, c.due, c.amountBase))
    : []
  const horizon = Math.max(0, Math.ceil((i.cycleEnd.getTime() - i.today.getTime()) / 86_400_000))
  const nextCharge = current
    ? forecastCharges(i.subs, i.cycleExpenses, i.today, horizon, i.base, i.rates).find((f) => f.due >= i.cycleStart && f.due <= i.cycleEnd)
    : undefined
  const charged = i.cycleExpenses.reduce(
    (sum, e) => (e.linkedSubscriptionId && !e.refundKind ? sum + convertCurrency(e.amount, e.currency, i.base, i.rates) : sum),
    0
  )
  return {
    items: live.items,
    next: nextCharge ? toRow(nextCharge.sub.name, nextCharge.due, nextCharge.amountBase) : null,
    charged,
    total: charged + left.reduce((sum, c) => sum + c.amount, 0),
    left,
    yearlySetAside: yearlySetAside(i.subs, i.today, i.base, i.rates),
  }
}

/* Debts */

export interface DebtLiveCtx {
  debtPayments: DebtPayment[]
  expenses: Expense[]
  base: Currency
  rates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
}

export interface LiveDebt {
  debt: Debt
  kind: FactDebt['kind']
  /** Monthly minimum, base. */
  minimum: number
  /** Still owed, base. */
  balance: number
  /** What was owed when it started, base. */
  startingBalance: number
}

export function debtKind(d: Debt): FactDebt['kind'] {
  if (d.debtType === 'credit_card') return 'credit_card'
  if (d.debtType === 'installment' || (d.debtType === 'general' && (d.installmentCount ?? 0) > 0)) return 'installment'
  return 'personal'
}

function debtToBase(amount: number, d: Debt, c: DebtLiveCtx): number {
  return calculateDebtRemainingInBaseCurrency(amount, d, c.base, c.rates, c.goldPricePerGram, c.goldPriceAvailable)
}

/** Debts the user still owes: not cleared, not money owed to them, balance above zero. */
export function liveDebts(debts: Debt[], c: DebtLiveCtx): LiveDebt[] {
  const balanceCtx = { expenses: c.expenses, exchangeRates: c.rates, allDebts: debts }
  const out: LiveDebt[] = []
  for (const d of debts) {
    if (d.status === 'cleared' || d.direction === 'they_owe') continue
    const balance = debtToBase(calculateDebtRemaining(d, c.debtPayments, balanceCtx), d, c)
    if (balance <= 0.005) continue
    const scheduled = (d.installmentAmount ?? 0) > 0
      ? debtToBase(monthlyFromFrequency(d.installmentAmount as number, d.installmentFrequency ?? 'monthly'), d, c)
      : 0
    const minimum = d.debtType === 'credit_card'
      ? minimumPaymentAmount(balance, d.minimumPaymentPercent)
      : Math.min(scheduled, balance)
    out.push({ debt: d, kind: debtKind(d), minimum, balance, startingBalance: debtToBase(d.startingBalance, d, c) })
  }
  return out
}

/** Payments made in the cycle, base, per debt id. */
export function debtPaidByDebt(
  debts: Debt[],
  c: DebtLiveCtx,
  monthKey: string,
  monthStartDay: number
): Record<string, number> {
  const byId = new Map(debts.map((d) => [d.id, d]))
  const out: Record<string, number> = {}
  for (const p of filterDebtPaymentsByMonth(c.debtPayments, monthKey, monthStartDay)) {
    const d = byId.get(p.debtId)
    if (d) out[d.id] = (out[d.id] ?? 0) + debtToBase(p.amountPaid, d, c)
  }
  return out
}

export function debtExtras(live: LiveDebt, paidThisCycle: number, c: DebtLiveCtx): DebtExtras {
  const { debt, kind, balance, startingBalance, minimum } = live
  const paidPercent = kind === 'credit_card' || startingBalance <= 0
    ? 0
    : Math.min(100, Math.max(0, ((startingBalance - balance) / startingBalance) * 100))
  const total = debt.installmentCount ?? 0
  const done = c.debtPayments.filter((p) => p.debtId === debt.id).length
  return {
    id: debt.id,
    name: debt.name,
    kind,
    balance,
    paidPercent,
    minimum,
    installment: kind === 'installment' && total > 0 ? { done: Math.min(done, total), total } : null,
    paidThisCycle: paidThisCycle > 0,
  }
}

/* Goals */

const GOAL_ICON: Record<GoalCategory, string> = {
  emergency_fund: 'shield-check', house: 'house', car: 'car', vacation: 'plane', education: 'graduation-cap',
  wedding: 'heart', phone_device: 'smartphone', family_support: 'users', sadaqah_charity: 'hand-heart',
  gift: 'gift', investment: 'trending-up', debt_freedom: 'landmark', quality_of_life: 'sparkles',
  spending_control: 'gauge', retirement: 'briefcase', business: 'briefcase', custom: 'target',
}

export const goalIconKey = (c: GoalCategory): string => GOAL_ICON[c] ?? 'target'

/** Goals that draw money from the plan: active and saving (not spending limits). */
export const savingGoals = (goals: Goal[]): Goal[] =>
  goals.filter((g) => g.status === 'active' && g.category !== 'spending_control').sort((a, b) => a.priority - b.priority)

/**
 * Planned monthly draw (base). Fixed amounts are stored in base like `allocateMonth` reads them;
 * quarterly goals spread over three months. A share is a percent of what the user usually keeps.
 */
export function goalMonthlyDraw(g: Goal, usualKeep: number | null): number {
  if (g.fundingMode === 'fixed') return (g.monthlyContribution ?? 0) / (g.frequency === 'quarterly' ? 3 : 1)
  if (g.fundingMode === 'share') return ((g.sharePct ?? 0) / 100) * (usualKeep ?? 0)
  return 0
}

export interface LiveGoal {
  goal: Goal
  /** Saved so far, base. */
  saved: number
  /** Target, base; null for open-ended goals. */
  target: number | null
  monthly: number
}

export function liveGoals(goals: Goal[], ctx: GoalProgressContext, usualKeep: number | null): LiveGoal[] {
  return savingGoals(goals).map((stored) => {
    const goal = withDebtDerived(stored, ctx)
    const toBase = (n: number) => convertCurrency(n, goal.currency, ctx.baseCurrency, ctx.exchangeRates)
    return {
      goal,
      saved: toBase(computeGoalProgress(stored, ctx)),
      target: goal.targetAmount == null ? null : toBase(goal.targetAmount),
      monthly: goalMonthlyDraw(goal, usualKeep),
    }
  })
}

export interface GoalRowLike {
  goal: Goal
  /** Saved so far in the goal's own currency. */
  current: number
  percent: number
  status: GoalStatusView
}

/** Goal cards for the page, from the goal rows the Goals page already computes. */
export function goalExtras(rows: GoalRowLike[], usualKeep: number | null, base: Currency, rates: Record<string, number>): GoalExtras[] {
  const byId = new Map(rows.map((r) => [r.goal.id, r]))
  return savingGoals(rows.map((r) => r.goal)).map((g) => {
    const row = byId.get(g.id)!
    return {
      id: g.id,
      name: g.name,
      icon: goalIconKey(g.category),
      current: convertCurrency(row.current, g.currency, base, rates),
      target: g.targetAmount == null ? null : convertCurrency(g.targetAmount, g.currency, base, rates),
      percent: row.percent,
      targetDate: g.targetDate,
      monthly: goalMonthlyDraw(g, usualKeep),
      status: row.status,
    }
  })
}

/* Income and savings */

/** Salary day of month: first payday of the largest recurring source still running. */
export function paydayDayOf(sources: IncomeSource[], today: Date): number | null {
  const todayIso = format(today, 'yyyy-MM-dd')
  const running = sources.filter((s) => s.isRecurring && (!s.effectiveEnd || s.effectiveEnd >= todayIso))
  const main = [...running].sort((a, b) => b.amount - a.amount)[0]
  if (!main) return null
  return sourcePaydayDays(main)?.[0] ?? main.dayOfMonth ?? null
}

/** Pockets that are not investments, in base. Unpriced pockets count 0. */
export function liquidSavings(
  accounts: SavingsAccount[],
  base: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number {
  return accounts
    .filter((a) => a.category !== 'investment')
    .reduce((sum, a) => sum + (savingsAccountBalanceInBase(a, base, rates, goldPricePerGram, goldPriceAvailable) ?? 0), 0)
}
