import {
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
  getDaysInMonth,
  differenceInDays,
  subDays,
  eachMonthOfInterval,
} from 'date-fns'
import type {
  Expense,
  IncomeSource,
  IncomeEvent,
  IncomeRecurringFrequency,
  BudgetCategory,
  Debt,
  DebtPayment,
  Currency,
  GoldKarat,
  AppSettings,
  SavingsHolding,
  SavingsAccount,
  SavingsTransaction,
} from '@/lib/store/types'
import { computeCreditCardOutstanding } from '@/lib/debt/computeCreditCardBalance'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { convertCurrency, tryConvertCurrency } from './currency'

/** When set, credit card outstanding is derived from expenses + payments. */
export type DebtBalanceContext = {
  expenses: Expense[]
  exchangeRates: Record<string, number>
  allDebts?: Debt[]
}

/**
 * Expense total in the user's current primary currency, derived from the stored original
 * `amount` + `currency` and live rates. Prefer this over summing `amountInBaseCurrency`, which
 * was captured at entry time and becomes wrong after the user changes primary currency.
 */
export function expenseAmountInBase(
  expense: Pick<Expense, 'amount' | 'currency' | 'amountInBaseCurrency' | 'refundKind'>,
  baseCurrency: Currency,
  rates: Record<string, number>,
  gross = false
): number {
  // A refunded/declined expense nets to zero — excluded from every spend/budget
  // aggregation. `gross` bypasses this so the card can show the struck original.
  if (expense.refundKind && !gross) return 0
  const converted = tryConvertCurrency(expense.amount, expense.currency, baseCurrency, rates)
  if (converted !== null) return converted
  return expense.amountInBaseCurrency
}

/** Converts per-period recurring income to an equivalent monthly amount for budgets and KPIs. */
export function incomeMonthlyMultiplier(freq: IncomeRecurringFrequency | undefined): number {
  const f = freq ?? 'monthly'
  if (f === 'weekly') return 52 / 12
  if (f === 'biweekly') return 26 / 12
  return 1
}

export function getMonthRange(monthStr: string, monthStartDay = 1): { start: Date; end: Date } {
  const date = parseISO(monthStr + '-01')
  if (monthStartDay <= 1) {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
    }
  }

  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, monthStartDay)
  const nextCycleStart = new Date(year, month + 1, monthStartDay)

  return {
    start,
    end: subDays(nextCycleStart, 1),
  }
}

export function filterExpensesByMonth(expenses: Expense[], monthStr: string, monthStartDay = 1): Expense[] {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  return expenses.filter((e) => {
    const date = parseISO(e.date)
    return isWithinInterval(date, { start, end })
  })
}

export function calculateMonthlyIncome(
  sources: IncomeSource[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  monthStr?: string,
  monthStartDay?: number
): number {
  let total = 0
  for (const source of sources) {
    if (source.isRecurring) {
      const monthlyEq = source.amount * incomeMonthlyMultiplier(source.recurringFrequency)
      total += convertCurrency(monthlyEq, source.currency, baseCurrency, rates)
    } else if (monthStr !== undefined && monthStartDay !== undefined) {
      const { start, end } = getMonthRange(monthStr, monthStartDay)
      const created = parseISO(source.createdAt)
      if (isWithinInterval(created, { start, end })) {
        total += convertCurrency(source.amount, source.currency, baseCurrency, rates)
      }
    }
  }
  return total
}

/**
 * True when a recurring source's effective window `[effectiveStart, effectiveEnd]`
 * (inclusive; open end = ongoing) overlaps `[windowStart, windowEnd]`.
 */
export function recurringActiveForWindow(
  source: IncomeSource,
  windowStart: Date,
  windowEnd: Date
): boolean {
  const effStart = parseISO((source.effectiveStart ?? source.createdAt).slice(0, 10))
  if (effStart > windowEnd) return false
  if (source.effectiveEnd && parseISO(source.effectiveEnd) < windowStart) return false
  return true
}

/**
 * Expected ("projected") income for a month: active effective-dated recurring
 * templates at their monthly-equivalent, plus one-time sources received inside the
 * month window. Respects `monthStartDay` (custom budget cycle). This is the number
 * budgets and projected-savings scale on — it does not depend on whether a paycheck
 * has actually landed yet.
 */
export function projectedIncomeForMonth(
  sources: IncomeSource[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  monthStr: string,
  monthStartDay = 1
): number {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  let total = 0
  for (const source of sources) {
    if (source.isRecurring) {
      if (!recurringActiveForWindow(source, start, end)) continue
      const monthlyEq = source.amount * incomeMonthlyMultiplier(source.recurringFrequency)
      total += convertCurrency(monthlyEq, source.currency, baseCurrency, rates)
    } else if (isWithinInterval(parseISO(source.createdAt), { start, end })) {
      total += convertCurrency(source.amount, source.currency, baseCurrency, rates)
    }
  }
  return total
}

const REALIZED_EVENT_STATUSES = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])

/**
 * Actual income received in a month: confirmed/late/partial events count as-is;
 * an active template occurrence with no event contributes its projected fallback
 * (assume received unless explicitly marked missed/partial). Standalone one-time
 * events count directly; one-time `income_sources` not yet superseded by an event
 * (created before the ledger cutover) are counted once, de-duped by id.
 *
 * Budgets must NOT use this — they scale on {@link projectedIncomeForMonth}. This is
 * for realized savings, the "income this month" KPI, reports history, and cash flow.
 */
export function actualIncomeForMonth(
  templates: IncomeSource[],
  events: IncomeEvent[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  monthStr: string,
  monthStartDay = 1
): number {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  const inWindow = (isoOrDate: string) => isWithinInterval(parseISO(isoOrDate), { start, end })
  let total = 0

  // One-time events. Track every covered source id (any status) so a backfilled or
  // missed one-time source isn't also counted from income_sources below.
  const coveredSourceIds = new Set<string>()
  for (const e of events) {
    if (e.templateId) continue
    coveredSourceIds.add(e.id) // backfilled one-time events reuse their source id
    if (!inWindow(e.receivedDate)) continue
    if (REALIZED_EVENT_STATUSES.has(e.status)) {
      total += convertCurrency(e.amount, e.currency, baseCurrency, rates)
    }
  }

  for (const t of templates) {
    if (t.isRecurring) {
      if (!recurringActiveForWindow(t, start, end)) continue
      const perOccurrence = convertCurrency(t.amount, t.currency, baseCurrency, rates)
      const mult = incomeMonthlyMultiplier(t.recurringFrequency)
      const evForT = events.filter((e) => e.templateId === t.id && inWindow(e.receivedDate))
      if (evForT.length === 0) {
        total += perOccurrence * mult // == projected; behavior preserved when no events exist
      } else {
        // Each event stands in for one occurrence: realized → its amount, projected →
        // the projection, missed → nothing. Occurrences with no event fall back to projected.
        let sub = 0
        for (const e of evForT) {
          if (REALIZED_EVENT_STATUSES.has(e.status)) sub += convertCurrency(e.amount, e.currency, baseCurrency, rates)
          else if (e.status === 'projected') sub += perOccurrence
          // 'missed' contributes nothing
        }
        const expected = Math.max(evForT.length, Math.round(mult))
        total += sub + (expected - evForT.length) * perOccurrence
      }
    } else if (!coveredSourceIds.has(t.id) && inWindow(t.createdAt)) {
      // One-time source with no event yet (added before Phase 6 wired event creation).
      total += convertCurrency(t.amount, t.currency, baseCurrency, rates)
    }
  }
  return total
}

/**
 * Is a recurring template's expected income for `monthStr` still awaiting? True when
 * the due date has passed (relative to `today`) and no linked event landed in the
 * month window. Display-only — an overdue paycheck is shown as "awaiting", NEVER
 * auto-counted as missed (only the user marks missed/partial).
 */
export function isIncomeOccurrencePending(
  template: IncomeSource,
  events: IncomeEvent[],
  monthStr: string,
  today: Date,
  monthStartDay = 1
): boolean {
  if (!template.isRecurring) return false
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  if (!recurringActiveForWindow(template, start, end)) return false
  const hasEvent = events.some(
    (e) => e.templateId === template.id && isWithinInterval(parseISO(e.receivedDate), { start, end })
  )
  if (hasEvent) return false
  // Monthly: due on dayOfMonth. Non-monthly (weekly/biweekly): treat the month start as due.
  const dueDay = template.recurringFrequency === 'monthly' ? template.dayOfMonth ?? 1 : 1
  const due = parseISO(`${monthStr}-${String(dueDay).padStart(2, '0')}`)
  return today >= due
}

/**
 * Best recurring template a manually-entered amount likely fulfills: same currency,
 * closest amount within 15% (mirrors matchSalary's CONFIRM tolerance). Used to
 * smart-suggest a link in the add/edit income forms. Returns null if none close.
 */
export function suggestIncomeTemplate(
  amount: number,
  currency: Currency,
  templates: IncomeSource[]
): IncomeSource | null {
  let best: IncomeSource | null = null
  let bestDiff = 0.15
  for (const t of templates) {
    if (!t.isRecurring || t.currency !== currency || !t.amount) continue
    const diff = Math.abs(amount - t.amount) / t.amount
    if (diff <= bestDiff) {
      best = t
      bestDiff = diff
    }
  }
  return best
}

/**
 * Recurring income that counts for a calendar month: sources whose effective window
 * overlaps that month. (New income sources added mid-timeline do not inflate earlier
 * months; ended sources stop counting after their `effectiveEnd`.)
 */
export function calculateRecurringIncomeForCalendarMonth(
  sources: IncomeSource[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  /** Any date falling inside the target month */
  monthDate: Date
): number {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  return sources.reduce((total, source) => {
    if (!source.isRecurring) return total
    if (!recurringActiveForWindow(source, monthStart, monthEnd)) return total
    const monthlyEq = source.amount * incomeMonthlyMultiplier(source.recurringFrequency)
    return total + convertCurrency(monthlyEq, source.currency, baseCurrency, rates)
  }, 0)
}

/**
 * Sum of recurring monthly income for each calendar month that overlaps [rangeStart, rangeEnd].
 * Full month amount is counted for any month with at least one day in range (no proration).
 */
export function sumRecurringIncomeOverDateRange(
  sources: IncomeSource[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const from = startOfMonth(rangeStart)
  const to = startOfMonth(rangeEnd)
  let sum = 0
  for (const monthStart of eachMonthOfInterval({ start: from, end: to })) {
    const monthEnd = endOfMonth(monthStart)
    const overlaps = monthEnd >= rangeStart && monthStart <= rangeEnd
    if (!overlaps) continue
    sum += calculateRecurringIncomeForCalendarMonth(sources, baseCurrency, rates, monthStart)
  }
  return sum
}

export function calculateTotalSpent(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  return expenses.reduce((total, e) => total + expenseAmountInBase(e, baseCurrency, rates), 0)
}

/** Spending totals for the expense budget ring and "Money Out" — excludes non-spend money movements (Savings allocations, ATM cash, transfers, FX, CC payoff). */
export function calculateTotalSpentExcludingSavings(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  return expenses
    .filter((e) => !isNonSpendCategory(e.category))
    .reduce((total, e) => total + expenseAmountInBase(e, baseCurrency, rates), 0)
}

export function calculateCategorySpending(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): Record<string, number> {
  const spending: Record<string, number> = {}
  for (const expense of expenses) {
    if (isNonSpendCategory(expense.category)) continue
    spending[expense.category] =
      (spending[expense.category] || 0) + expenseAmountInBase(expense, baseCurrency, rates)
  }
  return spending
}

export function effectiveCategoryBudget(
  b: BudgetCategory,
  settings: AppSettings,
  monthlyIncomeInBase: number
): number {
  const mode = settings.budgetEntryMode ?? 'amount'
  if (mode === 'percent_of_income' && monthlyIncomeInBase > 0) {
    const pct = b.percentOfIncome
    if (pct != null && !Number.isNaN(pct)) {
      return (pct / 100) * monthlyIncomeInBase
    }
  }
  return b.budgetedAmount
}

export function calculateTotalBudget(
  budgetCategories: BudgetCategory[],
  settings: AppSettings,
  monthlyIncomeInBase: number
): number {
  return budgetCategories.reduce(
    (total, b) => total + effectiveCategoryBudget(b, settings, monthlyIncomeInBase),
    0
  )
}

/** Budget total aligned with expense spending (excludes Savings allocation cap). */
export function calculateTotalBudgetExcludingSavings(
  budgetCategories: BudgetCategory[],
  settings: AppSettings,
  monthlyIncomeInBase: number
): number {
  return budgetCategories
    .filter((b) => !isNonSpendCategory(b.category))
    .reduce(
      (total, b) => total + effectiveCategoryBudget(b, settings, monthlyIncomeInBase),
      0
    )
}

export function totalSavingsHoldingsInBase(
  holdings: Pick<SavingsHolding, 'amount' | 'currency'>[],
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  return holdings.reduce(
    (sum, h) => sum + convertCurrency(h.amount, h.currency, baseCurrency, rates),
    0
  )
}

export function filterSavingsTransactionsByMonth(
  transactions: SavingsTransaction[],
  monthStr: string,
  monthStartDay = 1
): SavingsTransaction[] {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  return transactions.filter((t) => {
    const raw = t.date.length > 10 ? t.date : `${t.date}T12:00:00`
    const date = parseISO(raw)
    return isWithinInterval(date, { start, end })
  })
}

/** Net savings transfers this month in base currency (deposits − withdrawals). */
export function netSavingsLedgerInBaseForMonth(
  transactions: SavingsTransaction[],
  monthStr: string,
  monthStartDay: number,
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  const rows = filterSavingsTransactionsByMonth(transactions, monthStr, monthStartDay)
  return rows.reduce((sum, t) => {
    const inBase = convertCurrency(t.amount, t.currency, baseCurrency, rates)
    return sum + (t.type === 'deposit' ? inBase : -inBase)
  }, 0)
}

export function totalSavingsAccountsBalanceInBase(
  accounts: Pick<SavingsAccount, 'currentBalance' | 'currency'>[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number {
  return accounts.reduce((sum, a) => {
    if (a.currency === 'XAU') {
      if (!goldPriceAvailable) return sum
      return sum + goldGramsToMoney(a.currentBalance, goldPricePerGram, 24)
    }
    return sum + convertCurrency(a.currentBalance, a.currency, baseCurrency, rates)
  }, 0)
}

/**
 * Cash-flow "left to spend": income minus non-savings spending, legacy savings-tagged expenses,
 * and net savings ledger transfers for the month.
 */
export function calculateLeftToSpendCashFlow(params: {
  monthStr: string
  monthStartDay: number
  expenses: Expense[]
  incomeSources: IncomeSource[]
  incomeEvents: IncomeEvent[]
  savingsTransactions: SavingsTransaction[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  incomeBlocked: boolean
}): number {
  const {
    monthStr,
    monthStartDay,
    expenses,
    incomeSources,
    incomeEvents,
    savingsTransactions,
    baseCurrency,
    exchangeRates,
    incomeBlocked,
  } = params
  const monthlyExpenses = filterExpensesByMonth(expenses, monthStr, monthStartDay)
  const rawIncome = actualIncomeForMonth(
    incomeSources,
    incomeEvents,
    baseCurrency,
    exchangeRates,
    monthStr,
    monthStartDay
  )
  const totalIncome = incomeBlocked ? 0 : rawIncome
  const nonSav = calculateTotalSpentExcludingSavings(monthlyExpenses, baseCurrency, exchangeRates)
  const savTagged = monthlyExpenses
    .filter((e) => e.category === 'Savings')
    .reduce((sum, e) => sum + expenseAmountInBase(e, baseCurrency, exchangeRates), 0)
  const netLedger = netSavingsLedgerInBaseForMonth(
    savingsTransactions,
    monthStr,
    monthStartDay,
    baseCurrency,
    exchangeRates
  )
  return totalIncome - nonSav - savTagged - netLedger
}

export function totalDebtRemainingInBase(
  debts: Debt[],
  debtPayments: DebtPayment[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean,
  expenses?: Expense[]
): number {
  const balanceCtx: DebtBalanceContext | undefined =
    expenses !== undefined ? { expenses, exchangeRates: rates, allDebts: debts } : undefined
  let total = 0
  for (const debt of debts) {
    const remaining = calculateDebtRemaining(debt, debtPayments, balanceCtx)
    total += calculateDebtRemainingInBaseCurrency(
      remaining,
      debt,
      baseCurrency,
      rates,
      goldPricePerGram,
      goldPriceAvailable
    )
  }
  return total
}

/**
 * When `totalBudget` is 0 but there is spending, returns **-1** so the UI can show
 * a “no budget set” state instead of contradictory 0% vs over-budget copy.
 */
export function calculateBudgetUsedPercent(totalSpent: number, totalBudget: number): number {
  if (totalBudget === 0) {
    return totalSpent > 0 ? -1 : 0
  }
  return (totalSpent / totalBudget) * 100
}

export function calculateDaysLeftInMonth(monthStr: string, monthStartDay = 1): number {
  const { end } = getMonthRange(monthStr, monthStartDay)
  const today = new Date()
  const diff = differenceInDays(end, today)
  return Math.max(0, diff + 1)
}

export function getDaysInSelectedMonth(monthStr: string): number {
  const date = parseISO(monthStr + '-01')
  return getDaysInMonth(date)
}

export function goldPurityFactor(karat: GoldKarat = 24): number {
  return karat / 24
}

export function goldGramsToMoney(
  grams: number,
  pricePerGram24k: number,
  karat: GoldKarat = 24
): number {
  return grams * pricePerGram24k * goldPurityFactor(karat)
}

export function moneyToGoldGrams(
  amount: number,
  pricePerGram24k: number,
  karat: GoldKarat = 24
): number {
  const pricePerGramKarat = pricePerGram24k * goldPurityFactor(karat)
  if (pricePerGramKarat <= 0) return 0
  return amount / pricePerGramKarat
}

export function convertPaymentToDebtUnit(
  paymentAmount: number,
  paymentCurrency: string,
  debt: Debt,
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number
): number {
  if (debt.isGold) {
    const amountInBase = convertCurrency(paymentAmount, paymentCurrency, baseCurrency, rates)
    return moneyToGoldGrams(amountInBase, goldPricePerGram, debt.goldKarat)
  }
  return convertCurrency(paymentAmount, paymentCurrency, debt.currency, rates)
}

export function totalPaidTowardDebt(debtId: string, payments: DebtPayment[]): number {
  return payments.filter((p) => p.debtId === debtId).reduce((sum, p) => sum + p.amountPaid, 0)
}

/** Unclamped balance (can be negative if overpaid). */
export function calculateDebtRemainingRaw(
  debt: Debt,
  payments: DebtPayment[],
  ctx?: DebtBalanceContext
): number {
  if (debt.debtType === 'credit_card') {
    if (ctx?.expenses) {
      return computeCreditCardOutstanding(debt, ctx.expenses, payments, ctx.exchangeRates)
    }
    return Math.max(0, debt.startingBalance - totalPaidTowardDebt(debt.id, payments))
  }
  return debt.startingBalance - totalPaidTowardDebt(debt.id, payments)
}

const DEBT_PAID_EPS = 1e-6

export function isDebtFullyPaid(debt: Debt, payments: DebtPayment[], ctx?: DebtBalanceContext): boolean {
  if (debt.status === 'cleared') return true
  return calculateDebtRemainingRaw(debt, payments, ctx) <= DEBT_PAID_EPS
}

export type DebtPaymentComputeResult =
  | { ok: true; amountInDebtUnit: number; amountInBase: number; rateAtEntry: number }
  | { ok: false; error: string }

/**
 * Validates amount/rates and remaining balance for recording a debt payment (same rules as the debt payment sheet).
 */
export function computeDebtPaymentRecord(
  debt: Debt,
  amount: number,
  paymentCurrency: string,
  baseCurrency: Currency,
  exchangeRates: Record<string, number>,
  goldPricePerGram: number,
  debtPayments: DebtPayment[],
  balanceCtx?: DebtBalanceContext
): DebtPaymentComputeResult {
  if (Number.isNaN(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid payment amount.' }
  }

  if (isDebtFullyPaid(debt, debtPayments, balanceCtx)) {
    return { ok: false, error: 'This debt is already fully paid.' }
  }

  let amountInBase: number
  let amountInDebtUnit: number

  if (paymentCurrency === 'XAU' && debt.isGold) {
    amountInDebtUnit = amount
    amountInBase = goldGramsToMoney(amount, goldPricePerGram, debt.goldKarat)
  } else {
    const inBase = tryConvertCurrency(amount, paymentCurrency, baseCurrency, exchangeRates)
    if (inBase === null) {
      return {
        ok: false,
        error: `No exchange rate from ${paymentCurrency} to ${baseCurrency}. Update rates in Settings.`,
      }
    }
    amountInBase = inBase

    if (debt.isGold) {
      amountInDebtUnit = moneyToGoldGrams(amountInBase, goldPricePerGram, debt.goldKarat)
    } else {
      const inDebtUnit = tryConvertCurrency(amount, paymentCurrency, debt.currency, exchangeRates)
      if (inDebtUnit === null) {
        return {
          ok: false,
          error: `No exchange rate from ${paymentCurrency} to debt currency ${debt.currency}.`,
        }
      }
      amountInDebtUnit = inDebtUnit
    }
  }

  const rateAtEntry = amount > 0 ? amountInBase / amount : 1
  const remainingRaw = calculateDebtRemainingRaw(debt, debtPayments, balanceCtx)
  if (amountInDebtUnit > remainingRaw + 1e-6) {
    const unit = debt.isGold ? 'g' : debt.currency
    return {
      ok: false,
      error: `This payment is more than the remaining amount (${remainingRaw.toFixed(2)} ${unit}).`,
    }
  }

  return { ok: true, amountInDebtUnit, amountInBase, rateAtEntry }
}

/** Display / aggregates: never show negative remaining after full payoff. */
export function calculateDebtRemaining(
  debt: Debt,
  payments: DebtPayment[],
  ctx?: DebtBalanceContext
): number {
  return Math.max(0, calculateDebtRemainingRaw(debt, payments, ctx))
}

export function calculateDebtRemainingInBaseCurrency(
  remaining: number,
  debt: Debt,
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number {
  if (debt.isGold) {
    if (!goldPriceAvailable) return 0
    return goldGramsToMoney(remaining, goldPricePerGram, debt.goldKarat)
  }
  return convertCurrency(remaining, debt.currency, baseCurrency, rates)
}

export function calculateSavingsTotal(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  return expenses
    .filter((e) => e.category === 'Savings')
    .reduce((total, e) => total + expenseAmountInBase(e, baseCurrency, rates), 0)
}

export function getPaymentMethodBreakdown(
  expenses: Expense[],
  paymentMethods: { id: string; name: string }[],
  baseCurrency: Currency,
  rates: Record<string, number>
): { name: string; count: number; total: number }[] {
  const breakdown: Record<string, { count: number; total: number }> = {}

  for (const expense of expenses) {
    if (isNonSpendCategory(expense.category)) continue
    const method = paymentMethods.find((m) => m.id === expense.paymentMethodId)
    const name = method?.name || 'Unknown'
    if (!breakdown[name]) breakdown[name] = { count: 0, total: 0 }
    breakdown[name].count++
    breakdown[name].total += expenseAmountInBase(expense, baseCurrency, rates)
  }

  return Object.entries(breakdown).map(([name, data]) => ({
    name,
    ...data,
  }))
}
