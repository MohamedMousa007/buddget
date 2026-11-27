import type { Expense, IncomeEvent, SavingsTransaction } from '@/lib/store/types'
import { anchorGaps, type LedgerInput } from '@/lib/accounts/balance'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { isBorrowedMoney } from '@/lib/income/borrowed'
import { isLabel } from '@/lib/savings/labels'
import type { Cycle } from '@/lib/savings/carryDateLogic'

/** A month-end row that already exists: its cycle and when it was written (closed months are never reopened, §0). */
export interface SummaryWindow extends Cycle {
  createdAt: string
}

export interface LeftoverInput {
  cycle: Cycle
  base: string
  /** At the cycle's rates (C.rates). null = no rate: the row counts 0. */
  convert: (amount: number, from: string, to: string) => number | null
  /** The user's local calendar date of an instant. */
  dayOf: (instant: string) => string
  summaries: readonly SummaryWindow[]
  ledger: LedgerInput
}

export interface LeftoverFigures {
  income: number
  spending: number
  savedNet: number
  unexplainedOut: number
  leftover: number
}

const RECEIVED = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])
const cents = (n: number) => Math.round(n * 100) / 100

/**
 * leftover(C) = income − spending − savedNet − unexplainedOut (LOGIC_SPEC §4.3). A row counts in the cycle its date
 * falls in, unless that cycle's month-end row was written before the row arrived: then it counts in the cycle it
 * arrived in (late SMS, late refund), so a closed month never changes.
 */
export function leftover(i: LeftoverInput): LeftoverFigures {
  const { cycle, base, ledger } = i
  const pmCurrency = new Map(ledger.paymentMethods.map((m) => [m.id, String(m.currency)]))

  const countsIn = (date: string, createdAt: string | undefined): boolean => {
    const day = date.slice(0, 10)
    const owner = i.summaries.find((s) => s.start <= day && day < s.end)
    const at = owner && createdAt && Date.parse(createdAt) > Date.parse(owner.createdAt) ? i.dayOf(createdAt) : day
    return cycle.start <= at && at < cycle.end
  }
  /** Base value; a booked amount in a base-currency account wins over the live conversion (I-10). */
  const inBase = (amount: number, currency: string, booked?: number, bookedIn?: string): number => {
    if (currency === base) return amount
    if (booked != null && bookedIn === base) return booked
    return i.convert(amount, currency, base) ?? 0
  }

  let income = 0
  for (const e of ledger.incomeEvents) {
    if (!RECEIVED.has(e.status) || e.exclusion || isBorrowedMoney(e) || !countsIn(e.receivedDate, e.createdAt)) continue
    income += inBase(e.amount, e.currency, e.accountAmount, e.paymentMethodId ? pmCurrency.get(e.paymentMethodId) : undefined)
  }

  let spending = 0
  let savingsTagged = 0
  const fundedFrom = new Set<string>()
  for (const e of ledger.expenses) {
    if (e.fundedFromSavingsTxId) fundedFrom.add(e.fundedFromSavingsTxId)
    const refunded = refundOf(e)
    // A full refund carries its time; a partial one (refundedAmount alone) arrived with the row's last write.
    const refundAt = e.refundedAt ?? e.updatedAt ?? e.createdAt
    const refundHere = refunded > 0 && countsIn(refundAt ? i.dayOf(refundAt) : e.date, refundAt)
    const valueOf = (amount: number) => inBase(amount, e.currency, e.accountAmount == null ? undefined : (e.accountAmount * amount) / (e.amount || 1), e.paymentMethodId ? pmCurrency.get(e.paymentMethodId) : undefined)
    const here = countsIn(e.date, e.createdAt)
    if (e.category === 'Savings' && !e.spendExclusion) {
      if (here) savingsTagged += valueOf(e.amount)
      if (refundHere) savingsTagged -= valueOf(refunded)
      continue
    }
    if (isNonSpendExpense(e)) continue
    if (here) spending += valueOf(e.amount)
    if (refundHere) spending -= valueOf(refunded)
  }

  const parts = new Map(ledger.savingsAccounts.map((p) => [p.id, p]))
  let savedNet = savingsTagged
  for (const t of ledger.savingsTransactions) {
    if (!countsIn(t.date, t.createdAt)) continue
    savedNet += savedSign(t, fundedFrom, !!t.paymentMethodId && !parts.get(t.accountId)?.heldInPaymentMethodId) *
      (t.paymentMethodId && t.accountAmount != null ? inBase(t.accountAmount, pmCurrency.get(t.paymentMethodId) ?? t.currency) : inBase(t.amount, t.currency))
  }

  const adjustments = new Map(ledger.adjustments.map((a) => [a.id, a]))
  let gaps = 0
  for (const g of anchorGaps(ledger)) {
    const adj = adjustments.get(g.adjustmentId)
    if (!adj || !countsIn(i.dayOf(adj.occurredAt), adj.createdAt)) continue
    gaps += inBase(g.gap, pmCurrency.get(g.accountId) ?? base)
  }
  const unexplainedOut = Math.max(0, -gaps)

  const out = { income: cents(income), spending: cents(spending), savedNet: cents(savedNet), unexplainedOut: cents(unexplainedOut) }
  return { ...out, leftover: cents(out.income - out.spending - out.savedNet - out.unexplainedOut) }
}

/** The refunded or declined part of an expense, in its own currency. */
const refundOf = (e: Expense): number => (e.refundKind || e.refundedAt ? e.amount : Math.max(0, e.refundedAmount ?? 0))

/**
 * savedNet's sign for one savings row: set aside +, spent −, every other label 0 (release, opening, moves, month-end,
 * close); a pocket-funded spend −; money into an outside part from an account + (gold bought: its booked amount);
 * legacy pre-P2 cash-flow deposits +.
 */
function savedSign(t: SavingsTransaction, fundedFrom: ReadonlySet<string>, intoOutside: boolean): number {
  if (t.source === 'set_aside') return 1
  if (t.source === 'spent') return -1
  if (isLabel(t) || t.source === 'carry') return 0
  if (t.type === 'withdrawal') return fundedFrom.has(t.id) ? -1 : 0
  if (intoOutside) return 1
  return t.isCashFlow !== false ? 1 : 0
}
