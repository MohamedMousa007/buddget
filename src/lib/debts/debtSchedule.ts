import { addMonths, differenceInCalendarMonths, parseISO, startOfDay } from 'date-fns'
import { addCalendarWeeks, weeksElapsed } from '@/lib/time/calendarDays'
import { debtFamily } from '@/lib/debts/debtFamily'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { debtFreeBy, lastPaymentDate, paymentsToClear } from '@/lib/debts/heroStats'
import { installmentPaymentsCompleted, nextInstallmentDueDate } from '@/lib/debts/installmentSchedule'
import type { Debt, DebtPayment, RecurringDebtPayment } from '@/lib/store/types'

export interface ScheduledDebtPayment {
  debtId: string
  name: string
  date: Date
  /** Amount in the base currency. */
  amount: number
}

export interface DebtScheduleCtx {
  payments: DebtPayment[]
  recurring: RecurringDebtPayment[]
  /** What is still owed on a debt, in its own unit. */
  remaining: (d: Debt, payments: DebtPayment[]) => number
  toBase: (amount: number, currency: string) => number
}

/**
 * One scheduled payment per active debt (recurring plan > installment cycle > payoff goal) and each non-card debt's
 * projected last payment (null when it has no schedule). Shared by the Debts hero and the budget's debt-free month.
 */
export function debtSchedule(active: Debt[], ctx: DebtScheduleCtx, now: Date): { scheduled: ScheduledDebtPayment[]; ends: (Date | null)[] } {
  const scheduled: ScheduledDebtPayment[] = []
  const ends: (Date | null)[] = []
  const nameOf = (d: Debt) => d.name || d.personName || d.person || '—'
  const today = startOfDay(now)
  for (const d of active) {
    const pays = ctx.payments.filter((p) => p.debtId === d.id)
    const plan = ctx.recurring.find((r) => r.debtId === d.id && r.isActive)
    const trackEnd = debtFamily(d) !== 'credit_card'
    if (plan) {
      const next = parseISO(plan.nextDueDate)
      if (trackEnd) {
        const left = d.isGold ? 0 : ctx.toBase(ctx.remaining(d, pays), d.currency)
        const periods = paymentsToClear(left, ctx.toBase(plan.amount, plan.currency))
        // An unpaid past due date is paid now: the rest of the plan runs from today.
        const end = lastPaymentDate(next < today ? today : next, plan.frequency, periods)
        ends.push(end ?? (d.goal ? parseISO(d.goal.targetDate) : null))
      }
      scheduled.push({ debtId: d.id, name: nameOf(d), date: next, amount: ctx.toBase(plan.amount, plan.currency) })
      continue
    }
    if (d.debtType === 'installment') {
      const done = installmentPaymentsCompleted(d, pays)
      const next = nextInstallmentDueDate(d, done)
      if (next && d.installmentAmount) {
        scheduled.push({ debtId: d.id, name: nameOf(d), date: next, amount: ctx.toBase(d.installmentAmount, d.currency) })
        ends.push(lastPaymentDate(next < today ? today : next, d.installmentFrequency ?? 'monthly', (d.installmentCount ?? 0) - done))
      } else ends.push(null)
      continue
    }
    const g = d.goal
    if (trackEnd) ends.push(g ? parseISO(g.targetDate) : null)
    if (g && debtFamily(d) === 'borrow' && !d.isGold && g.calculatedAmount > 0) {
      const start = parseISO(d.createdAt)
      const monthsPer = g.paymentFrequency === 'quarterly' ? 3 : g.paymentFrequency === 'annually' ? 12 : 1
      const date =
        g.paymentFrequency === 'weekly'
          ? addCalendarWeeks(start, weeksElapsed(now, start) + 1)
          : addMonths(start, (Math.floor(Math.max(0, differenceInCalendarMonths(now, start)) / monthsPer) + 1) * monthsPer)
      scheduled.push({ debtId: d.id, name: nameOf(d), date, amount: ctx.toBase(g.calculatedAmount, d.currency) })
    }
  }
  scheduled.sort((a, b) => a.date.getTime() - b.date.getTime())
  return { scheduled, ends }
}

export interface DebtOutlook {
  /** The next payment due today or later; never a past date. */
  next: ScheduledDebtPayment | null
  /** Scheduled payments whose date has passed unpaid: their total and the earliest date. */
  overdue: { amount: number; since: Date } | null
  /** Due from today to `cycleEnd`, overdue payments excluded. */
  dueAhead: number
  /** Projected last payment. Null while a payment is overdue (the plan has slipped) or when it would be in the past. */
  debtFreeDate: Date | null
  unplanned: number
}

/** Splits a debt schedule around `now`: what is overdue, what comes next, and when the debts end. */
export function debtOutlook(scheduled: ScheduledDebtPayment[], ends: (Date | null)[], now: Date, cycleEnd: Date): DebtOutlook {
  const today = startOfDay(now)
  const past = scheduled.filter((p) => p.date < today)
  const ahead = scheduled.filter((p) => p.date >= today)
  const overdue = past.length
    ? { amount: past.reduce((s, p) => s + p.amount, 0), since: past.reduce((m, p) => (p.date < m ? p.date : m), past[0].date) }
    : null
  const { date, unplanned } = debtFreeBy(ends)
  return {
    next: ahead[0] ?? null,
    overdue,
    dueAhead: ahead.filter((p) => p.date <= cycleEnd).reduce((s, p) => s + p.amount, 0),
    debtFreeDate: overdue || !date || date < today ? null : date,
    unplanned,
  }
}

/** True when a debt the user owes has a scheduled payment past its date and unpaid. */
export function owedDebtOverdue(debts: Debt[], ctx: DebtScheduleCtx, now: Date): boolean {
  const owed = debts.filter((d) => d.status !== 'cleared' && !isOwedToUser(d))
  const today = startOfDay(now)
  return debtSchedule(owed, ctx, now).scheduled.some((p) => p.date < today)
}
