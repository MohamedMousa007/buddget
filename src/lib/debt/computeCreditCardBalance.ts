import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, parseISO, setDate, startOfDay } from 'date-fns'
import type { Currency, Debt, DebtPayment, Expense } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

function paidToward(debtId: string, payments: DebtPayment[]): number {
  return payments.filter((p) => p.debtId === debtId).reduce((sum, p) => sum + p.amountPaid, 0)
}

/**
 * Outstanding revolving balance: starting balance + card expenses (converted to debt currency) − payments.
 */
export function computeCreditCardOutstanding(
  debt: Debt,
  expenses: Expense[],
  payments: DebtPayment[],
  exchangeRates: Record<string, number>
): number {
  if (debt.debtType !== 'credit_card') return debt.startingBalance

  let balance = debt.startingBalance
  const debtCur = debt.currency as Currency

  if (debt.linkedPaymentMethodId) {
    const cardExpenses = expenses.filter((e) => e.paymentMethodId === debt.linkedPaymentMethodId)
    for (const e of cardExpenses) {
      const conv = tryConvertCurrency(e.amount, e.currency, debtCur, exchangeRates)
      balance += conv ?? e.amount
    }
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

  const y = today.getFullYear()
  const m = today.getMonth()
  let cycleEnd = new Date(y, m, clampDayInMonth(y, m, rawDay))
  let cycleStart = addDays(addMonths(cycleEnd, -1), 1)
  cycleStart.setHours(0, 0, 0, 0)
  cycleEnd.setHours(0, 0, 0, 0)

  while (today > cycleEnd) {
    cycleEnd = addMonths(cycleEnd, 1)
    const ye = cycleEnd.getFullYear()
    const me = cycleEnd.getMonth()
    cycleEnd = new Date(ye, me, clampDayInMonth(ye, me, rawDay))
    cycleStart = addDays(addMonths(cycleEnd, -1), 1)
    cycleStart.setHours(0, 0, 0, 0)
    cycleEnd.setHours(0, 0, 0, 0)
  }

  const list = expenses.filter((e) => {
    if (e.paymentMethodId !== debt.linkedPaymentMethodId) return false
    const d = startOfDay(parseISO(e.date.slice(0, 10)))
    return d >= cycleStart && d <= cycleEnd
  })

  return { expenses: list, cycleStart, cycleEnd }
}

export function sumExpensesInDebtCurrency(
  expenses: Expense[],
  debtCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  let sum = 0
  for (const e of expenses) {
    const conv = tryConvertCurrency(e.amount, e.currency, debtCurrency, exchangeRates)
    sum += conv ?? e.amount
  }
  return sum
}

/** Next calendar due date from paymentDueDay (this month or next). */
export function getNextCreditCardDueDate(debt: Debt, ref: Date = new Date()): string | null {
  if (!debt.paymentDueDay) return null
  const dueDay = Math.min(31, Math.max(1, debt.paymentDueDay))
  const y = ref.getFullYear()
  const m = ref.getMonth()
  let candidate = setDate(new Date(y, m, 1), dueDay)
  if (candidate < startOfDay(ref)) {
    candidate = setDate(new Date(y, m + 1, 1), dueDay)
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
