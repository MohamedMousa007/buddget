import type {
  AccountAdjustment, Debt, DebtPayment, Expense, IncomeEvent, PaymentMethod, SavingsAccount, SavingsTransaction,
} from '@/lib/store/types'
import { DEFAULT_CASH_ID, isTracked } from './kinds'
import { resolveAccountId } from './resolve'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { paidAsEntered } from '@/lib/debts/paymentAmounts'
import { incomeEventIdForTx } from '@/lib/savings/accountLeg'

export interface LedgerInput {
  paymentMethods: readonly PaymentMethod[]
  expenses: readonly Expense[]
  incomeEvents: readonly IncomeEvent[]
  debtPayments: readonly DebtPayment[]
  debts: readonly Debt[]
  savingsTransactions: readonly SavingsTransaction[]
  savingsAccounts: readonly SavingsAccount[]
  adjustments: readonly AccountAdjustment[]
  /** null = no rate known: the row is counted 1:1 (gold legs are skipped) and the account is flagged approximate. */
  convert: (amount: number, from: string, to: string) => number | null
}

export interface AccountBalance {
  id: string
  currency: string
  /** Opening balance plus every movement since `openingAt`, in account currency. */
  balance: number
  /** Sum of held-in pockets, in account currency. */
  held: number
  /** Spendable: balance minus what is set aside, never below zero. */
  free: number
  /** True when any movement needed a currency conversion with no rate. */
  approx: boolean
}

const THREE_DECIMALS = new Set(['KWD', 'BHD', 'OMR', 'JOD'])
const unit = (currency: string) => (THREE_DECIMALS.has(currency) ? 1000 : 100)
export const minorUnit = unit
const RECEIVED = new Set(['confirmed', 'late', 'partial'])

/** Instant of a ledger row: its exact time, else noon of its day (rows that predate `occurredAt`). */
export function instantOf(occurredAt: string | undefined, date: string): number {
  if (occurredAt) return new Date(occurredAt).getTime()
  return new Date(`${date.slice(0, 10)}T12:00:00`).getTime()
}

/**
 * Balance of every tracked account at `asOf` (default: now). Pure and order-independent: movements are
 * summed as integer minor units so float drift cannot accumulate. Untracked accounts (no opening balance
 * yet) are absent from the result — callers show "Set balance".
 */
export function computeBalances(input: LedgerInput, asOf: number = Date.now()): Map<string, AccountBalance> {
  const { paymentMethods: pms } = input
  const acc = new Map<string, { minor: number; approx: boolean; from: number; currency: string }>()
  for (const pm of pms) {
    if (isTracked(pm)) {
      const cur = String(pm.currency)
      acc.set(pm.id, {
        minor: Math.round((pm.openingBalance as number) * unit(cur)), approx: false,
        from: new Date(pm.openingAt as string).getTime(), currency: cur,
      })
    }
  }

  const apply = (accountId: string | null, amount: number, currency: string, at: number) => {
    if (!accountId) return
    const a = acc.get(accountId)
    // Rows at or before the anchor are already inside the opening balance (it was read after them).
    if (!a || at <= a.from || at > asOf) return
    let v = amount
    if (currency && currency !== a.currency) {
      const c = input.convert(amount, currency, a.currency)
      if (c == null) {
        a.approx = true
        // Grams of gold are not money: with no gold price the leg is left out, never booked 1:1.
        if (currency === 'XAU' || a.currency === 'XAU') return
      } else v = c
    }
    a.minor += Math.round(v * unit(a.currency))
  }

  const settledByExpense = new Set<string>()
  for (const e of input.expenses) {
    if (e.linkedDebtPaymentId) settledByExpense.add(e.linkedDebtPaymentId)
    if (e.refundedAt || e.fundedFromSavingsTxId) continue // a pocket-funded expense leaves no account of its own: the pocket withdrawal carries the holder leg
    // No funding source named: a CC payoff or an SMS the resolver could not place must not drain Cash.
    const unfunded = !e.paymentMethodId || e.paymentMethodId === DEFAULT_CASH_ID
    if (unfunded && e.category === 'CC Payoff') continue
    const at = instantOf(e.occurredAt, e.date)
    // An unplaced SMS still credits the account it names as destination (a wallet top-up from "my own money").
    if (!(unfunded && e.smsLogId)) apply(resolveAccountId(e.paymentMethodId, pms), -Math.max(0, e.amount - (e.refundedAmount ?? 0)), e.currency, at)
    if (e.toPaymentMethodId) apply(resolveAccountId(e.toPaymentMethodId, pms), e.amount, e.currency, at)
  }

  for (const i of input.incomeEvents) {
    if (!RECEIVED.has(i.status) || !i.paymentMethodId) continue
    apply(resolveAccountId(i.paymentMethodId, pms), i.amount, i.currency, instantOf(i.occurredAt, i.receivedDate))
  }

  // A payoff normally also writes an expense (counted above); only count payments that left no expense behind.
  const owedToUser = new Set(input.debts.filter(isOwedToUser).map((d) => d.id))
  const goldDebts = new Set(input.debts.filter((d) => d.isGold).map((d) => d.id))
  for (const p of input.debtPayments) {
    if (p.fundedFromSavings || settledByExpense.has(p.id) || !p.paymentMethodId) continue
    // Legacy gold payment: `amountPaid` is grams and no money amount was recorded, so there is nothing to book 1:1.
    if (p.originalAmount == null && goldDebts.has(p.debtId)) continue
    const sign = owedToUser.has(p.debtId) ? 1 : -1
    const paid = paidAsEntered(p, '')
    apply(resolveAccountId(p.paymentMethodId, pms), sign * paid.amount, paid.currency, instantOf(p.occurredAt, p.date))
  }

  // Principal leg: lending takes the money out of the account, borrowing puts it in. Only debts that carry one
  // (the user said the money moved); every other debt moves an account through its payments alone.
  for (const d of input.debts) {
    if (!d.principalPaymentMethodId || !d.principalAt || !d.principalAmount || d.isGold) continue
    const sign = isOwedToUser(d) ? -1 : 1
    apply(resolveAccountId(d.principalPaymentMethodId, pms), sign * d.principalAmount, d.principalCurrency ?? d.currency, new Date(d.principalAt).getTime())
  }

  const pockets = new Map(input.savingsAccounts.map((s) => [s.id, s]))
  const eventsById = new Map(input.incomeEvents.map((e) => [e.id, e]))
  const groups = new Map<string, SavingsTransaction[]>()
  for (const t of input.savingsTransactions) {
    if (!t.transferGroupId) continue
    const g = groups.get(t.transferGroupId)
    if (g) g.push(t)
    else groups.set(t.transferGroupId, [t])
  }
  for (const t of input.savingsTransactions) {
    const pocket = pockets.get(t.accountId)
    const holder = pocket?.heldInPaymentMethodId
    const at = instantOf(t.occurredAt, t.date)
    const isDeposit = t.type === 'deposit'
    if (t.paymentMethodId) { // 1: an explicit account leg
      const target = resolveAccountId(t.paymentMethodId, pms)
      if (holder && holder === target) continue
      const leg = isDeposit ? -t.amount : t.amount
      apply(target, leg, t.currency, at)
      // The pocket's money sits inside its holding account: a move from or to another account is a transfer between the two.
      if (holder) apply(holder, -leg, t.currency, at)
      continue
    }
    if (!holder) continue // 2: standalone pocket, counted on its own
    if (t.transferGroupId) { // 3: pocket-to-pocket move, a leg only across holders
      const other = groups.get(t.transferGroupId)?.find((o) => o.id !== t.id)
      if (other && pockets.get(other.accountId)?.heldInPaymentMethodId === holder) continue
      apply(holder, isDeposit ? t.amount : -t.amount, t.currency, at)
      continue
    }
    if (t.isCashFlow === false) continue // 4: opening, declared money, correction
    if (t.source === 'carry') continue // 5: month-carry label move
    if (isDeposit) continue // 6: earmark of money already in the holder
    const ev = eventsById.get(incomeEventIdForTx(t.id))
    if (ev && !ev.paymentMethodId) continue // 7: released inside the holder
    apply(holder, -t.amount, t.currency, at) // 8: money left the holder
  }

  for (const j of input.adjustments) {
    const pm = pms.find((m) => m.id === j.paymentMethodId)
    apply(j.paymentMethodId, j.delta, pm ? String(pm.currency) : '', new Date(j.occurredAt).getTime())
  }

  const out = new Map<string, AccountBalance>()
  for (const [id, a] of acc) {
    if (a.from > asOf) continue // the account did not have a known balance yet at that instant
    const u = unit(a.currency)
    let heldMinor = 0
    let approx = a.approx
    for (const s of input.savingsAccounts) {
      if (s.heldInPaymentMethodId !== id) continue
      const c = s.currency === a.currency ? s.currentBalance : input.convert(s.currentBalance, s.currency, a.currency)
      if (c == null) approx = true
      else heldMinor += Math.round(c * u)
    }
    out.set(id, {
      id, currency: a.currency, approx,
      balance: a.minor / u, held: heldMinor / u, free: Math.max(0, a.minor - heldMinor) / u,
    })
  }
  return out
}
