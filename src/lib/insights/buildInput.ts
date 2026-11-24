import { addDays, addMonths, differenceInCalendarDays, getDay, parseISO, startOfDay, subDays } from 'date-fns'
import { isBnplPlan } from '@/lib/debt/bnpl'
import { smsAccountLabelKind } from '@/lib/accounts/unplacedSms'
import { priceChange } from '@/lib/subscriptions/subscriptionPricing'
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
import { isBorrowedMoney } from '@/lib/income/borrowed'

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

export function buildInsightInput(src: InsightSource, leftToSpend: number, now: Date, incomeKnown = true): InsightInput {
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

  // Pattern findings look back over a pool of counted habit purchases (no debt repayments, no unconverted rows).
  const poolRows = reportSpendRows(filterExpensesByRange(src.expenses, { start: subDays(today, 200), end: today })).filter((e) => !e.isDebtPayment && !isExpenseUnconverted(e, base, rates))
  const pool = poolRows.map((e) => ({ e, day: parseISO(`${e.date.slice(0, 10)}T12:00:00`), amount: expenseAmountInBase(e, base, rates) }))
  const within = (from: Date, to: Date) => pool.filter((x) => x.day >= startOfDay(from) && x.day <= to)
  const cycleStart = getMonthRange(key, startDay).start

  const priorCategoryMean = new Map<string, number>()
  const priorWindows = [1, 2, 3].map((back) => getMonthRange(monthKey(firstOfCycle, back), startDay))
  for (const w of priorWindows) for (const x of within(w.start, w.end)) priorCategoryMean.set(x.e.category, (priorCategoryMean.get(x.e.category) ?? 0) + x.amount / 3)
  const categories = [...byCategory].map(([name, thisCycle]) => ({ name, thisCycle, usual: usualSpend === null ? null : (priorCategoryMean.get(name) ?? 0) }))

  const earliest = pool.reduce<Date | null>((m, x) => (m === null || x.day < m ? x.day : m), null)
  const last56 = within(subDays(today, 55), today)
  const byDayTotals = Array<number>(7).fill(0)
  for (const x of last56) byDayTotals[getDay(x.day)] += x.amount
  const weekday = {
    weeks: earliest ? Math.min(8, Math.floor((differenceInCalendarDays(today, earliest) + 1) / 7)) : 0,
    purchases: last56.length,
    byDay: byDayTotals.map((t) => t / 8),
    overallDaily: byDayTotals.reduce((a, b) => a + b, 0) / 56,
  }

  // Confirmed paydays, merged when within 3 days, newest first, only those with a full window of days after them.
  const payDates = [...new Set(src.incomeEvents.filter((ev) => ev.status === 'confirmed' && ev.amount > 0 && !ev.exclusion && !isBorrowedMoney(ev)).map((ev) => ev.receivedDate.slice(0, 10)))].sort()
  const merged: Date[] = []
  for (const d of payDates.map((x) => parseISO(`${x}T12:00:00`))) if (merged.length === 0 || differenceInCalendarDays(d, merged[merged.length - 1]) > 3) merged.push(d)
  let firstWeek = 0, restSum = 0, firstDays = 0, restDays = 0, paydayCount = 0, paydayPurchases = 0
  merged.forEach((d, idx) => {
    const next = merged[idx + 1] ?? addDays(d, 35)
    const end = next > today ? today : addDays(next, -1)
    if (differenceInCalendarDays(end, d) < 14 || idx < merged.length - 5) return
    const inWin = within(d, end)
    paydayCount += 1
    paydayPurchases += inWin.length
    for (const x of inWin) if (differenceInCalendarDays(x.day, d) < 7) firstWeek += x.amount
    else restSum += x.amount
    firstDays += 7
    restDays += differenceInCalendarDays(end, d) + 1 - 7
  })
  const firstDaily = firstDays > 0 ? firstWeek / firstDays : 0
  const restDaily = restDays > 0 ? restSum / restDays : 0
  const paydays = { count: paydayCount, purchases: paydayPurchases, liftPct: restDaily > 0 ? ((firstDaily / restDaily) - 1) * 100 : null }

  const thisCycleHabit = habit.filter((e) => !e.refundedAt)
  const biggest = thisCycleHabit.reduce<Expense | null>((m, e) => (!m || expenseAmountInBase(e, base, rates) > expenseAmountInBase(m, base, rates) ? e : m), null)
  let unusual: InsightInput['unusual'] = null
  if (biggest) {
    const earlier = pool.filter((x) => x.e.category === biggest.category && x.e.id !== biggest.id && x.day < cycleStart && !x.e.refundedAt).map((x) => x.amount).sort((a, b) => a - b)
    const median = earlier.length > 0 ? earlier[Math.floor(earlier.length / 2)] : 0
    unusual = { description: biggest.description, category: biggest.category, amount: expenseAmountInBase(biggest, base, rates), typical: median, priorCount: earlier.length }
  }

  const income = projectedIncomeForMonth(src.incomeSources, base, rates, key, startDay)
  const smallThreshold = income > 0 ? Math.max(10, Math.round((income * 0.003) / 10) * 10) : 0
  const small = { threshold: smallThreshold, count: 0, total: 0 }
  if (smallThreshold > 0) for (const e of thisCycleHabit) {
    const a = expenseAmountInBase(e, base, rates)
    if (a < smallThreshold) { small.count += 1; small.total += a }
  }

  const cardCash = { cardAvg: 0, cardN: 0, cashAvg: 0, cashN: 0 }
  for (const x of within(subDays(today, 89), today)) {
    if (smsAccountLabelKind(x.e) === 'unassigned') continue
    const type = typeOf.get(x.e.paymentMethodId ?? '')
    if (type === 'cash') { cardCash.cashN += 1; cardCash.cashAvg += x.amount }
    else if (type === 'credit_card' || type === 'debit_card' || type === 'prepaid_card' || type === 'bnpl') { cardCash.cardN += 1; cardCash.cardAvg += x.amount }
  }
  if (cardCash.cardN > 0) cardCash.cardAvg /= cardCash.cardN
  if (cardCash.cashN > 0) cardCash.cashAvg /= cardCash.cashN

  let priceRise: InsightInput['priceRise'] = null
  for (const sub of src.subscriptions) {
    if (!isCharging(sub, today)) continue
    const ch = priceChange(sub, src.expenses)
    if (!ch || ch.to <= ch.from) continue
    const rise = convertCurrency(ch.to - ch.from, sub.currency, base, rates)
    if (!priceRise || rise > priceRise.rise) priceRise = { name: sub.name, rise }
  }

  const debts = countedDebts(src.debts, src.paymentMethods)
  const payments = countedDebtPayments(src.debtPayments, src.debts, src.paymentMethods)
  const bnpl = { plans: 0, remaining: 0, monthly: 0, incomeMonthly: income }
  // Instalment plans I owe, interest-free assumption: the what-if card reads the whole set, the BNPL finding only the BNPL ones.
  const debtPlan = { remaining: 0, monthly: 0 }
  for (const d of debts) {
    if (d.debtType !== 'installment' || d.direction === 'they_owe' || d.status === 'cleared' || d.isGold) continue
    const left = calculateDebtRemaining(d, payments)
    if (left <= 0) continue
    const remainingBase = calculateDebtRemainingInBaseCurrency(left, d, base, rates, src.goldPricePerGram, src.goldPriceAvailable)
    const monthlyBase = convertCurrency((d.installmentAmount ?? 0) * INSTALLMENT_PER_MONTH[d.installmentFrequency ?? 'monthly'], d.currency as typeof base, base, rates)
    debtPlan.remaining += remainingBase
    debtPlan.monthly += monthlyBase
    if (isBnplPlan(d, src.paymentMethods)) {
      bnpl.plans += 1
      bnpl.remaining += remainingBase
      bnpl.monthly += monthlyBase
    }
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
    incomeKnown,
    topCategory: top,
    keptLast,
    bnpl,
    subs,
    bills,
    pay,
    categories,
    paydays,
    weekday,
    unusual,
    small,
    cardCash,
    priceRise,
    debtPlan,
    netWorthPath: null,
  }
}
