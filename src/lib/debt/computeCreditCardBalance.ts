import { differenceInCalendarDays, format, getDaysInMonth, parseISO, startOfDay } from 'date-fns'
import type { Currency, Debt, DebtPayment, Expense } from '@/lib/store/types'
import { addCalendarDays } from '@/lib/time/calendarDays'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { sumConverted, tryConvertCurrency, type PartialSum } from '@/lib/utils/currency'
import { isCardPlan } from '@/lib/debt/bnpl'
import { addByFrequency } from '@/lib/debts/installmentSchedule'

function paidToward(debtId: string, payments: readonly DebtPayment[]): number {
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

/** Converts an amount between currencies; null = no rate (the amount is left out). */
export type Convert = (amount: number, from: string, to: string) => number | null

/** The rows a card's balance reads. `debts` holds its plans; omit it and the card has none. */
export interface CardRows {
  expenses: readonly Expense[]
  payments: readonly DebtPayment[]
  debts?: readonly Debt[]
}

const DAY_MS = 86_400_000
const daysApart = (a: string, b: string) =>
  Math.abs(new Date(`${a.slice(0, 10)}T12:00:00`).getTime() - new Date(`${b.slice(0, 10)}T12:00:00`).getTime()) / DAY_MS

/**
 * The plan's purchase charge on the card (§4.10): an expense on the card's method that is not an instalment, linked to the
 * plan, or else unlinked at the plan's full price within 3 days of its start, its creation or `near`. Undefined = none.
 */
export function cardPlanPurchaseCharge(
  plan: Debt, card: Pick<Debt, 'linkedPaymentMethodId'>, expenses: readonly Expense[], near: readonly string[] = [],
): Expense | undefined {
  const pm = card.linkedPaymentMethodId
  if (!pm) return undefined
  const onCard = expenses.filter((e) => e.paymentMethodId === pm && !e.isDebtPayment && !e.refundKind)
  const days = [plan.startDate, plan.createdAt, ...near].filter((d): d is string => !!d)
  return onCard.find((e) => e.linkedDebtId === plan.id)
    ?? onCard.find((e) => !e.linkedDebtId && Math.abs(e.amount - plan.startingBalance) < 0.005 && String(e.currency) === String(plan.currency)
      && days.some((d) => daysApart(e.date, d) <= 3))
}

/**
 * The instalment plans that live inside this card (§4.10): linked to it AND with their purchase charged on it. A plan with
 * no purchase on the card is owed on its own, never zero times. Cleared ones included (their payments still count).
 */
export function cardPlansOf(card: Pick<Debt, 'id' | 'linkedPaymentMethodId'>, debts: readonly Debt[] = [], expenses: readonly Expense[] = []): Debt[] {
  return debts.filter((d) => isCardPlan(d) && d.linkedCreditCardDebtId === card.id && !!cardPlanPurchaseCharge(d, card, expenses))
}

/**
 * A plan payment made with the card itself is the schedule ticking over: the card bill pays it, no money moved (§4.10),
 * so neither it nor its own charge on the card changes what the card owes. Paid from an account or a pocket, it is money.
 */
export function isCardPlanTick(p: Pick<DebtPayment, 'paymentMethodId' | 'fundedFromSavings'>, card: Pick<Debt, 'linkedPaymentMethodId'>): boolean {
  return !p.fundedFromSavings && (!p.paymentMethodId || p.paymentMethodId === card.linkedPaymentMethodId)
}

/**
 * owed(c) (§4.1): starting balance + card charges − payments to the card − payments to its plans. The plan purchase is
 * one full-price charge; an instalment row on the card (legacy `Debt` charge or a new `Installment` one) is not a charge.
 */
export function cardOwed(card: Debt, rows: CardRows, convert: Convert): number {
  if (card.debtType !== 'credit_card') return card.startingBalance
  const plans = cardPlansOf(card, rows.debts, rows.expenses)
  const planIds = new Set(plans.map((p) => p.id))
  let balance = card.startingBalance
  const linked = card.linkedPaymentMethodId
  if (linked) {
    const charges = rows.expenses.filter((e) => chargesToCard(e, linked) && !(e.isDebtPayment && e.linkedDebtId && planIds.has(e.linkedDebtId)))
    balance += sumConverted(charges, (e) => convert(Math.max(0, e.amount - (e.refundedAmount ?? 0)), e.currency, card.currency)).total
  }
  balance -= paidToward(card.id, rows.payments)
  for (const plan of plans) {
    const paid = rows.payments.filter((p) => p.debtId === plan.id && !isCardPlanTick(p, card)).reduce((sum, p) => sum + p.amountPaid, 0)
    balance -= plan.currency === card.currency ? paid : (convert(paid, plan.currency, card.currency) ?? 0)
  }
  return Math.max(0, balance)
}

/**
 * Outstanding revolving balance: starting balance + card charges (converted to debt currency) − payments, including
 * payments to the card's plans when `debts` is given.
 */
export function computeCreditCardOutstanding(
  debt: Debt,
  expenses: Expense[],
  payments: DebtPayment[],
  exchangeRates: Record<string, number>,
  debts: readonly Debt[] = []
): number {
  return cardOwed(debt, { expenses, payments, debts }, (a, from, to) => tryConvertCurrency(a, from, to, exchangeRates))
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/** The card's next statement close (its `paymentDueDay`) on or after `ref`; a card with none bills up to `ref`. */
export function nextStatementClose(card: Debt, ref: Date): string {
  return getNextCreditCardDueDate(card, ref) ?? dayKey(ref)
}

/** Instalments of `plan` billed by `closeDay` (yyyy-MM-dd): its due dates on or before that day. */
export function planBilledCount(plan: Debt, closeDay: string): number {
  const count = plan.installmentCount ?? 0
  if (!plan.startDate || count <= 0) return count
  const start = parseISO(plan.startDate.slice(0, 10))
  let n = 0
  while (n < count && dayKey(addByFrequency(start, plan.installmentFrequency ?? 'monthly', n)) <= closeDay) n++
  return n
}

/**
 * unbilledPlan(P) (§4.1): min(the schedule not yet billed, the principal still owed), in the plan's currency. A cleared
 * plan has nothing left to bill.
 */
export function planUnbilled(plan: Debt, payments: readonly DebtPayment[], closeDay: string): number {
  if (plan.status === 'cleared' || !plan.installmentCount) return 0
  const per = plan.installmentAmount ?? plan.startingBalance / plan.installmentCount
  const schedule = per * Math.max(0, plan.installmentCount - planBilledCount(plan, closeDay))
  const principal = plan.startingBalance - paidToward(plan.id, payments)
  return Math.max(0, Math.min(schedule, principal))
}

/** Σ unbilledPlan over the card's plans at `ref`, in the card's currency (a plan with no rate is left out). */
export function cardUnbilledPlans(card: Debt, rows: CardRows, convert: Convert, ref: Date): number {
  const close = nextStatementClose(card, ref)
  let total = 0
  for (const plan of cardPlansOf(card, rows.debts, rows.expenses)) {
    const left = planUnbilled(plan, rows.payments, close)
    total += plan.currency === card.currency ? left : (convert(left, plan.currency, card.currency) ?? 0)
  }
  return total
}

/** What the card holds back from its paying account (§4.1): everything owed except unbilled plan principal. */
export function cardHoldBack(card: Debt, rows: CardRows, convert: Convert, ref: Date): number {
  return Math.max(0, cardOwed(card, rows, convert) - cardUnbilledPlans(card, rows, convert, ref))
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
  const cycleStart = addCalendarDays(previousEnd, 1)

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
  return sumConverted(expenses, (e) => tryConvertCurrency(Math.max(0, e.amount - (e.refundedAmount ?? 0)), e.currency, debtCurrency, exchangeRates))
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
