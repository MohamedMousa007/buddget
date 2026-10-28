import { addDays, differenceInCalendarDays, format, getDaysInMonth, parseISO, startOfDay } from 'date-fns'
import type { Currency, Debt, DebtPayment, Expense } from '@/lib/store/types'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { sumConverted, tryConvertCurrency, type PartialSum } from '@/lib/utils/currency'

function paidToward(debtId: string, payments: DebtPayment[]): number {
  return payments.filter((p) => p.debtId === debtId).reduce((sum, p) => sum + p.amountPaid, 0)
}

/**
 * True for a row that genuinely adds to what is owed on the card.
 *
 * Excludes:
 *  - refunded/declined rows — the charge was reversed, so it must not inflate the balance
 *    forever (`expenseAmountInBase` already zeroes these everywhere else);
 *  - non-spend money movement, for two distinct reasons:
 *      · a `CC Payoff` posted against the card itself would cancel out its own payment;
 *      · every other non-spend category is money MOVING, whose consumption is recognised
 *        later, when it is actually spent. Loading a wallet (`Top up`) or taking cash out
 *        (`ATM Cash Withdrawal`) moves value you still hold; the purchase you eventually
 *        make from that wallet or cash is what counts. Adding the movement here as well
 *        would count the same money twice:
 *
 *            Top up 500 -> +500 owed  ... then spend 500 from the wallet -> −500 spend
 *            = −1000 for 500 of real consumption.
 *
 * A previous version narrowed this to settlements only, on the argument that a card
 * top-up is "money you owe". True of the DEBT DISPLAY in isolation, and wrong for net
 * worth — the offsetting value you now hold is exactly what the later spend records. This
 * matches `categoryMeta`'s definition and the wallet-transfer model: one movement, booked
 * once, counted when consumed.
 */
function chargesToCard(e: Expense, linkedPaymentMethodId: string): boolean {
  return (
    e.paymentMethodId === linkedPaymentMethodId &&
    !e.refundKind &&
    !isNonSpendCategory(e.category)
  )
}

/** Card charges in the debt currency; a charge with no FX path is left out and flags `incomplete` (never counted 1:1). */
export function cardChargesDetail(
  debt: Debt,
  expenses: Expense[],
  exchangeRates: Record<string, number>
): PartialSum {
  const linked = debt.linkedPaymentMethodId
  if (!linked) return { total: 0, incomplete: false }
  return sumExpensesInDebtCurrencyDetail(
    expenses.filter((e) => chargesToCard(e, linked)),
    debt.currency as Currency,
    exchangeRates
  )
}

/**
 * Outstanding revolving balance: starting balance + card charges (converted to debt currency) − payments.
 */
export function computeCreditCardOutstanding(
  debt: Debt,
  expenses: Expense[],
  payments: DebtPayment[],
  exchangeRates: Record<string, number>
): number {
  if (debt.debtType !== 'credit_card') return debt.startingBalance

  let balance = debt.startingBalance
  const linked = debt.linkedPaymentMethodId
  if (linked) {
    balance += cardChargesDetail(debt, expenses, exchangeRates).total
  }

  balance -= paidToward(debt.id, payments)
  return Math.max(0, balance)
}

/**
 * Expenses in the current billing cycle window (statement close = paymentDueDay each month).
 */
function clampDayInMonth(year: number, monthIndex: number, day: number): number {
  const dim = getDaysInMonth(new Date(year, monthIndex))
  return Math.min(Math.max(1, day), dim)
}

/** The due date in a given month, clamped to the month's last day (day 31 in February is the 28th). */
function dueDateInMonth(year: number, monthIndex: number, day: number): Date {
  const first = new Date(year, monthIndex, 1)
  return new Date(first.getFullYear(), first.getMonth(), clampDayInMonth(first.getFullYear(), first.getMonth(), day))
}

export function getCurrentBillingCycleExpenses(
  debt: Debt,
  expenses: Expense[],
  _exchangeRates: Record<string, number>,
  ref: Date = new Date()
): { expenses: Expense[]; cycleStart: Date; cycleEnd: Date } {
  if (!debt.linkedPaymentMethodId || !debt.paymentDueDay) {
    return { expenses: [], cycleStart: ref, cycleEnd: ref }
  }

  const rawDay = debt.paymentDueDay
  const today = startOfDay(ref)

  let cycleEnd = dueDateInMonth(today.getFullYear(), today.getMonth(), rawDay)
  if (today > cycleEnd) cycleEnd = dueDateInMonth(today.getFullYear(), today.getMonth() + 1, rawDay)
  const previousEnd = dueDateInMonth(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, rawDay)
  const cycleStart = addDays(previousEnd, 1)

  const linked = debt.linkedPaymentMethodId
  const list = expenses.filter((e) => {
    // Same predicate as the balance: once payoffs carry a real funding method, a payoff
    // made from the card's own bank would otherwise show up here as a *charge*.
    if (!chargesToCard(e, linked)) return false
    const d = startOfDay(parseISO(e.date.slice(0, 10)))
    return d >= cycleStart && d <= cycleEnd
  })

  return { expenses: list, cycleStart, cycleEnd }
}

export function sumExpensesInDebtCurrencyDetail(
  expenses: Expense[],
  debtCurrency: Currency,
  exchangeRates: Record<string, number>
): PartialSum {
  return sumConverted(expenses, (e) => tryConvertCurrency(e.amount, e.currency, debtCurrency, exchangeRates))
}

export function sumExpensesInDebtCurrency(
  expenses: Expense[],
  debtCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  return sumExpensesInDebtCurrencyDetail(expenses, debtCurrency, exchangeRates).total
}

/** Next calendar due date from paymentDueDay (this month or next). */
export function getNextCreditCardDueDate(debt: Debt, ref: Date = new Date()): string | null {
  if (!debt.paymentDueDay) return null
  const dueDay = debt.paymentDueDay
  let candidate = dueDateInMonth(ref.getFullYear(), ref.getMonth(), dueDay)
  if (candidate < startOfDay(ref)) {
    candidate = dueDateInMonth(ref.getFullYear(), ref.getMonth() + 1, dueDay)
  }
  return format(candidate, 'yyyy-MM-dd')
}

export function daysUntilDue(dueIso: string, ref: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(dueIso.slice(0, 10)), startOfDay(ref))
}

export function minimumPaymentAmount(
  outstanding: number,
  minimumPaymentPercent: number | undefined
): number {
  const pct = minimumPaymentPercent ?? 5
  return Math.max(0, (outstanding * pct) / 100)
}

/** Utilization 0–1+ (can exceed 1 if over limit). */
export function creditUtilizationRatio(outstanding: number, creditLimit: number | undefined): number | null {
  if (creditLimit == null || creditLimit <= 0) return null
  return outstanding / creditLimit
}

export function utilizationBarTone(ratio: number | null): 'green' | 'amber' | 'red' | 'neutral' {
  if (ratio == null) return 'neutral'
  if (ratio < 0.3) return 'green'
  if (ratio <= 0.7) return 'amber'
  return 'red'
}
