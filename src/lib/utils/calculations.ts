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
import { convertCurrency, tryConvertCurrency } from './currency'

/**
 * Expense total in the user's current primary currency, derived from the stored original
 * `amount` + `currency` and live rates. Prefer this over summing `amountInBaseCurrency`, which
 * was captured at entry time and becomes wrong after the user changes primary currency.
 */
export function expenseAmountInBase(
  expense: Pick<Expense, 'amount' | 'currency' | 'amountInBaseCurrency'>,
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
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
  rates: Record<string, number>
): number {
  return sources.reduce((total, source) => {
    if (!source.isRecurring) return total
    const monthlyEq = source.amount * incomeMonthlyMultiplier(source.recurringFrequency)
    return total + convertCurrency(monthlyEq, source.currency, baseCurrency, rates)
  }, 0)
}

/**
 * Recurring income that counts for a calendar month: sources that existed by the end of that month.
 * (New income sources added mid-timeline do not inflate earlier months.)
 */
export function calculateRecurringIncomeForCalendarMonth(
  sources: IncomeSource[],
  baseCurrency: Currency,
  rates: Record<string, number>,
  /** Any date falling inside the target month */
  monthDate: Date
): number {
  const monthEnd = endOfMonth(monthDate)
  return sources.reduce((total, source) => {
    if (!source.isRecurring) return total
    if (parseISO(source.createdAt) > monthEnd) return total
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

/** Spending totals for the expense budget ring and "Money Out" — excludes Savings (allocations, not consumption). */
export function calculateTotalSpentExcludingSavings(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  return expenses
    .filter((e) => e.category !== 'Savings')
    .reduce((total, e) => total + expenseAmountInBase(e, baseCurrency, rates), 0)
}

export function calculateCategorySpending(
  expenses: Expense[],
  baseCurrency: Currency,
  rates: Record<string, number>
): Record<string, number> {
  const spending: Record<string, number> = {}
  for (const expense of expenses) {
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
    .filter((b) => b.category !== 'Savings')
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
  rates: Record<string, number>
): number {
  return accounts.reduce(
    (sum, a) => sum + convertCurrency(a.currentBalance, a.currency, baseCurrency, rates),
    0
  )
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
    savingsTransactions,
    baseCurrency,
    exchangeRates,
    incomeBlocked,
  } = params
  const monthlyExpenses = filterExpensesByMonth(expenses, monthStr, monthStartDay)
  const rawIncome = calculateMonthlyIncome(incomeSources, baseCurrency, exchangeRates)
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
  goldPricePerGram: number
): number {
  let total = 0
  for (const debt of debts) {
    const remaining = calculateDebtRemaining(debt, debtPayments)
    total += calculateDebtRemainingInBaseCurrency(
      remaining,
      debt,
      baseCurrency,
      rates,
      goldPricePerGram
    )
  }
  return total
}

export function calculateBudgetUsedPercent(totalSpent: number, totalBudget: number): number {
  if (totalBudget === 0) return 0
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
export function calculateDebtRemainingRaw(debt: Debt, payments: DebtPayment[]): number {
  return debt.startingBalance - totalPaidTowardDebt(debt.id, payments)
}

const DEBT_PAID_EPS = 1e-6

export function isDebtFullyPaid(debt: Debt, payments: DebtPayment[]): boolean {
  if (debt.status === 'cleared') return true
  return calculateDebtRemainingRaw(debt, payments) <= DEBT_PAID_EPS
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
  debtPayments: DebtPayment[]
): DebtPaymentComputeResult {
  if (Number.isNaN(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid payment amount.' }
  }

  if (isDebtFullyPaid(debt, debtPayments)) {
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
  const remainingRaw = calculateDebtRemainingRaw(debt, debtPayments)
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
export function calculateDebtRemaining(debt: Debt, payments: DebtPayment[]): number {
  return Math.max(0, calculateDebtRemainingRaw(debt, payments))
}

export function calculateDebtRemainingInBaseCurrency(
  remaining: number,
  debt: Debt,
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number
): number {
  if (debt.isGold) {
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
