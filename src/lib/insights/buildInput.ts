import { addMonths, parseISO, startOfDay } from 'date-fns'
import { isBnplPlan } from '@/lib/debt/bnpl'
import { smsAccountLabelKind } from '@/lib/accounts/unplacedSms'
import { chargeAmount, forecastCharges, isCharging } from '@/lib/subscriptions/subscriptionForecast'
import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { reportSpendRows } from '@/lib/reports/reportsPeriod'
import {
  actualIncomeForMonth,
  budgetMonthKeyFor,
  calculateDebtRemaining,
  calculateDebtRemainingInBaseCurrency,
  expenseAmountInBase,
  filterExpensesByRange,
  getMonthRange,
  isExpenseUnconverted,
  projectedIncomeForMonth,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { dailySpendingRate, daysElapsedInMonth, projectedMonthSpend, totalDaysInMonth } from '@/lib/utils/spendingPace'
import type { Debt, Expense, FinanceStore, Subscription } from '@/lib/store/types'
import { MIN_EXPENSES } from './detectors'
import type { InsightInput } from './types'

export type InsightSource = Pick<
  FinanceStore,
  'expenses' | 'incomeSources' | 'incomeEvents' | 'paymentMethods' | 'subscriptions' | 'debts' | 'debtPayments' | 'settings' | 'exchangeRates' | 'goldPricePerGram' | 'goldPriceAvailable'
>

const CYCLE_MONTHS_PER_YEAR: Record<Subscription['billingCycle'], number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12 }
const INSTALLMENT_PER_MONTH: Record<NonNullable<Debt['installmentFrequency']>, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 }

const monthKey = (first: Date, back: number) => {
  const d = addMonths(first, -back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Counted spend in one cycle: the same `isReportSpendRow` rule as Reports and Flow, converted with the same helper. */
function cycleSpend(expenses: Expense[], key: string, startDay: number, base: InsightSource['settings']['baseCurrency'], rates: Record<string, number>) {
  const rows = reportSpendRows(filterExpensesByRange(expenses, getMonthRange(key, startDay)))
  return { rows, total: rows.reduce((s, e) => s + expenseAmountInBase(e, base, rates), 0) }
}

export function buildInsightInput(src: InsightSource, leftToSpend: number, now: Date): InsightInput {
  const { settings, exchangeRates: rates } = src
  const base = settings.baseCurrency
  const startDay = settings.monthStartDay
  const key = budgetMonthKeyFor(now, startDay)
  const firstOfCycle = parseISO(`${key}-01`)
  const today = startOfDay(now)

  const { rows, total: spent } = cycleSpend(src.expenses, key, startDay, base, rates)
  const daysElapsed = daysElapsedInMonth(key, startDay)
  const totalDays = totalDaysInMonth(key, startDay)
  const daysLeft = Math.max(0, totalDays - daysElapsed)
  const dailyRate = dailySpendingRate(spent, daysElapsed)

  const prior = [1, 2, 3].map((back) => cycleSpend(src.expenses, monthKey(firstOfCycle, back), startDay, base, rates))
  const usualSpend = prior.every((p) => p.rows.length >= MIN_EXPENSES) ? prior.reduce((s, p) => s + p.total, 0) / 3 : null

  const lastKey = monthKey(firstOfCycle, 1)
  const lastReceived = actualIncomeForMonth(src.incomeSources, src.incomeEvents, base, rates, lastKey, startDay, true)
  const keptLast = prior[0].rows.length >= MIN_EXPENSES && lastReceived > 0 ? { received: lastReceived, spent: prior[0].total } : null

  // Habit detectors leave out debt repayments and rows with no usable conversion.
  const habit = rows.filter((e) => !e.isDebtPayment && !isExpenseUnconverted(e, base, rates))
  const byCategory = new Map<string, number>()
  const pay = { card: 0, cash: 0, unassigned: 0, other: 0, placedCount: 0 }
  const typeOf = new Map(src.paymentMethods.map((m) => [m.id, m.type]))
  let habitTotal = 0
  for (const e of habit) {
    const amount = expenseAmountInBase(e, base, rates)
    habitTotal += amount
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount)
    if (smsAccountLabelKind(e) === 'unassigned') pay.unassigned += amount
    else {
      pay.placedCount += 1
      const type = typeOf.get(e.paymentMethodId ?? '')
      if (type === 'cash') pay.cash += amount
      else if (type === 'credit_card' || type === 'debit_card' || type === 'prepaid_card' || type === 'bnpl') pay.card += amount
      else pay.other += amount
    }
  }
  let top: InsightInput['topCategory'] = null
  for (const [name, amount] of byCategory) if (!top || amount > top.amount) top = { name, amount, total: habitTotal }

  const debts = countedDebts(src.debts, src.paymentMethods)
  const payments = countedDebtPayments(src.debtPayments, src.debts, src.paymentMethods)
  const bnpl = { plans: 0, remaining: 0, monthly: 0, incomeMonthly: projectedIncomeForMonth(src.incomeSources, base, rates, key, startDay) }
  for (const d of debts) {
    if (!isBnplPlan(d, src.paymentMethods) || d.status === 'cleared') continue
    const left = calculateDebtRemaining(d, payments)
    if (left <= 0) continue
    bnpl.plans += 1
    bnpl.remaining += calculateDebtRemainingInBaseCurrency(left, d, base, rates, src.goldPricePerGram, src.goldPriceAvailable)
    bnpl.monthly += convertCurrency((d.installmentAmount ?? 0) * INSTALLMENT_PER_MONTH[d.installmentFrequency ?? 'monthly'], d.currency as typeof base, base, rates)
  }

  const live = src.subscriptions.filter((s) => isCharging(s, today))
  const subs = {
    count: live.length,
    monthly: live.reduce((s, sub) => s + convertCurrency(chargeAmount(sub) * CYCLE_MONTHS_PER_YEAR[sub.billingCycle], sub.currency, base, rates), 0),
  }
  const due = daysLeft > 0 ? forecastCharges(src.subscriptions, src.expenses, today, daysLeft, base, rates) : []
  const bills = { count: due.length, total: due.reduce((s, f) => s + f.amountBase, 0) }

  return {
    cycle: { daysElapsed, daysLeft, totalDays },
    spent,
    expenseCount: rows.length,
    dailyRate,
    projectedSpend: projectedMonthSpend(dailyRate, totalDays),
    usualSpend,
    leftToSpend,
    topCategory: top,
    keptLast,
    bnpl,
    subs,
    bills,
    pay,
  }
}
