import type {
  AccountAdjustment, Debt, DebtPayment, Expense, IncomeEvent, PaymentMethod, SavingsAccount, SavingsTransaction,
} from '@/lib/store/types'
import { DEFAULT_CASH_ID, isTracked } from './kinds'
import { resolveAccountId } from './resolve'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { paidAsEntered } from '@/lib/debts/paymentAmounts'
import { incomeEventIdForTx } from '@/lib/savings/accountLeg'
import { cardHolds } from './cardHold'

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
  /** Also total the money in and out since this instant (balance corrections excluded): `flowsIn` / `flowsOut`. */
  flowsFrom?: number
}

export interface AccountBalance {
  id: string
  currency: string
  /** Opening balance plus every movement since `openingAt`, in account currency. */
  balance: number
  /** Sum of held-in pockets, in account currency. */
  held: number
  /** What the credit cards this account pays hold back (LOGIC_SPEC §4.1), in account currency. */
  cardHold: number
  /** Free to spend: balance − set aside − card hold-back (I-3). Can be negative; caps use `Math.max(0, free)`. */
  free: number
  /** True when any movement needed a currency conversion with no rate. */
  approx: boolean
  /** Only with `flowsFrom`: money in and money out since then, both positive, in account currency. */
  flowsIn?: number
  flowsOut?: number
}

const THREE_DECIMALS = new Set(['KWD', 'BHD', 'OMR', 'JOD'])
const unit = (currency: string) => (THREE_DECIMALS.has(currency) ? 1000 : 100)
export const minorUnit = unit
const RECEIVED = new Set(['confirmed', 'late', 'partial'])
/** Savings rows that only relabel money already in its account (LOGIC_SPEC §3.3). Legacy `carry` keeps rule 5. */
export const LABEL_SOURCES: ReadonlySet<string> = new Set(['set_aside', 'opening', 'move_in', 'move_out', 'month_end', 'month_end_undo', 'release', 'spent', 'close'])

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
  const acc = new Map<string, { minor: number; approx: boolean; open: number; from: number; currency: string; inMinor: number; outMinor: number }>()
  const anchors = anchorsByAccount(input)
  for (const pm of pms) {
    if (isTracked(pm)) {
      const cur = String(pm.currency)
      const open = new Date(pm.openingAt as string).getTime()
      // I-1: the balance restarts at the latest anchor at or before asOf (the opening balance is the first one).
      const base = latestAnchor(anchors.get(pm.id), open, asOf)
      acc.set(pm.id, {
        minor: base ? base.minor(unit(cur)) : Math.round((pm.openingBalance as number) * unit(cur)), approx: false,
        open, from: base ? base.at : open, currency: cur, inMinor: 0, outMinor: 0,
      })
    }
  }

  const flowsFrom = input.flowsFrom
  const apply: ApplyLeg = (accountId, amount, currency, at, flow = true, booked) => {
    if (!accountId) return
    const a = acc.get(accountId)
    // Rows at or before the opening balance are already inside it (it was read after them).
    if (!a || at <= a.open || at > asOf) return
    const v = legValue(input, amount, currency, a.currency, booked)
    if (v === null) {
      a.approx = true
      return
    }
    if (v.approx) a.approx = true
    const minor = Math.round(v.value * unit(a.currency))
    // Rows at or before the latest anchor are inside it; money in and out still counts for the flows.
    if (!(at <= a.from)) a.minor += minor
    if (flow && flowsFrom !== undefined && at >= flowsFrom) {
      if (minor > 0) a.inMinor += minor
      else a.outMinor -= minor
    }
  }

  walkLegs(input, apply)

  const holds = cardHolds({
    ...input,
    expenses: input.expenses.filter((e) => instantOf(e.occurredAt, e.date) <= asOf),
    debtPayments: input.debtPayments.filter((p) => instantOf(p.occurredAt, p.date) <= asOf),
  }, asOf)
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
    const hold = holds.get(id)
    if (hold?.approx) approx = true
    const holdMinor = hold ? Math.round(hold.amount * u) : 0
    out.set(id, {
      id, currency: a.currency, approx,
      balance: a.minor / u, held: heldMinor / u, cardHold: holdMinor / u, free: (a.minor - heldMinor - holdMinor) / u,
      ...(flowsFrom !== undefined ? { flowsIn: a.inMinor / u, flowsOut: a.outMinor / u } : {}),
    })
  }
  return out
}

/** `booked`: the row's stored amount in the account's currency (I-10), already signed; used instead of a live rate. */
type ApplyLeg = (accountId: string | null, amount: number, currency: string, at: number, flow?: boolean, booked?: number) => void

/**
 * A leg's value in the account's currency: the booked amount for a cross-currency row that stored one, else the live
 * conversion. Null = leave the leg out (grams of gold with no price are not money, never booked 1:1).
 */
function legValue(input: LedgerInput, amount: number, currency: string, accountCurrency: string, booked?: number): { value: number; approx: boolean } | null {
  if (!currency || currency === accountCurrency) return { value: amount, approx: false }
  if (booked != null && Number.isFinite(booked)) return { value: booked, approx: false }
  const c = input.convert(amount, currency, accountCurrency)
  if (c != null) return { value: c, approx: false }
  if (currency === 'XAU' || accountCurrency === 'XAU') return null
  return { value: amount, approx: true }
}

interface Anchor { id: string; at: number; value: number; minor: (u: number) => number }

/** Anchor adjustments (I-1) per account, oldest first; ties broken by id so every reader picks the same one. */
function anchorsByAccount(input: Pick<LedgerInput, 'adjustments'>): Map<string, Anchor[]> {
  const out = new Map<string, Anchor[]>()
  for (const j of input.adjustments) {
    if (j.anchorBalance == null || !Number.isFinite(j.anchorBalance)) continue
    const at = new Date(j.occurredAt).getTime()
    if (Number.isNaN(at)) continue
    const value = j.anchorBalance
    const list = out.get(j.paymentMethodId) ?? []
    list.push({ id: j.id, at, value, minor: (u) => Math.round(value * u) })
    out.set(j.paymentMethodId, list)
  }
  for (const list of out.values()) list.sort((x, y) => x.at - y.at || x.id.localeCompare(y.id))
  return out
}

/** The latest anchor after the opening balance and at or before `asOf`; undefined = the opening balance is the base. */
function latestAnchor(list: readonly Anchor[] | undefined, open: number, asOf: number): Anchor | undefined {
  if (!list) return undefined
  let hit: Anchor | undefined
  for (const k of list) {
    if (k.at > asOf) break
    if (k.at > open) hit = k
  }
  return hit
}

/** Splits a source-side booked amount over the refunded part, like the leg itself. */
const bookedPart = (booked: number | undefined, amount: number, net: number): number | undefined =>
  booked == null ? undefined : amount > 0 ? (booked * net) / amount : 0

/** Every account leg the ledger implies, in no particular order: the one walk both balance views share. */
function walkLegs(input: LedgerInput, apply: ApplyLeg): void {
  const { paymentMethods: pms } = input
  const settledByExpense = new Set<string>()
  for (const e of input.expenses) {
    if (e.linkedDebtPaymentId) settledByExpense.add(e.linkedDebtPaymentId)
    if (e.refundedAt || e.fundedFromSavingsTxId) continue // a pocket-funded expense leaves no account of its own: the pocket withdrawal carries the holder leg
    // No funding source named: a CC payoff or an SMS the resolver could not place must not drain Cash.
    const unfunded = !e.paymentMethodId || e.paymentMethodId === DEFAULT_CASH_ID
    if (unfunded && e.category === 'CC Payoff') continue
    const at = instantOf(e.occurredAt, e.date)
    // An unplaced SMS still credits the account it names as destination (a wallet top-up from "my own money").
    const net = Math.max(0, e.amount - (e.refundedAmount ?? 0))
    const bookedOut = bookedPart(e.accountAmount, e.amount, net)
    if (!(unfunded && e.smsLogId)) apply(resolveAccountId(e.paymentMethodId, pms), -net, e.currency, at, true, bookedOut == null ? undefined : -bookedOut)
    if (e.toPaymentMethodId) apply(resolveAccountId(e.toPaymentMethodId, pms), e.amount, e.currency, at, true, e.toAccountAmount)
  }

  for (const i of input.incomeEvents) {
    if (!RECEIVED.has(i.status) || !i.paymentMethodId) continue
    apply(resolveAccountId(i.paymentMethodId, pms), i.amount, i.currency, instantOf(i.occurredAt, i.receivedDate), true, i.accountAmount)
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
    if (t.source && LABEL_SOURCES.has(t.source)) continue // 0: a label changes a part, never an account (I-4)
    const pocket = pockets.get(t.accountId)
    const holder = pocket?.heldInPaymentMethodId
    const at = instantOf(t.occurredAt, t.date)
    const isDeposit = t.type === 'deposit'
    if (t.paymentMethodId) { // 1: an explicit account leg
      const target = resolveAccountId(t.paymentMethodId, pms)
      if (holder && holder === target) continue
      const leg = isDeposit ? -t.amount : t.amount
      apply(target, leg, t.currency, at, true, t.accountAmount == null ? undefined : isDeposit ? -t.accountAmount : t.accountAmount)
      // The pocket's money sits inside its holding account: a move from or to another account is a transfer between the two.
      if (holder) apply(holder, -leg, t.currency, at)
      continue
    }
    if (!holder) continue // 2: standalone pocket, counted on its own
    // 5 first: a month-end carry is a label on money already in the holder. The server stores its idempotency key as
    // transfer_group_id, so without this the row would read as an orphan move (rule 3) and move the holder.
    if (t.source === 'carry') continue
    if (t.transferGroupId) { // 3: pocket-to-pocket move, a leg only across holders
      const other = groups.get(t.transferGroupId)?.find((o) => o.id !== t.id)
      if (other && pockets.get(other.accountId)?.heldInPaymentMethodId === holder) continue
      apply(holder, isDeposit ? t.amount : -t.amount, t.currency, at)
      continue
    }
    if (t.isCashFlow === false) continue // 4: opening, declared money, correction
    if (isDeposit) continue // 6: earmark of money already in the holder
    const ev = eventsById.get(incomeEventIdForTx(t.id))
    if (ev && !ev.paymentMethodId) continue // 7: released inside the holder
    apply(holder, -t.amount, t.currency, at) // 8: money left the holder
  }

  for (const j of input.adjustments) {
    if (j.anchorBalance != null) continue // an anchor is a base, never a leg (I-1); its stored delta is for display
    const pm = pms.find((m) => m.id === j.paymentMethodId)
    apply(j.paymentMethodId, j.delta, pm ? String(pm.currency) : '', new Date(j.occurredAt).getTime(), false)
  }
}

/** Tracked account balances at an instant: balance and currency only. */
export type BalancesAt = (asOf: number) => Map<string, Pick<AccountBalance, 'balance' | 'currency'>>

/**
 * The ledger walked once, for many instants: `at(asOf)` gives the same balance and currency as `computeBalances(input,
 * asOf)` (accounts with no known balance yet left out), without rebuilding the ledger each time.
 */
export function balancesOverTime(input: LedgerInput): BalancesAt {
  const series = ledgerSeries(input)
  return (asOf) => {
    const out = new Map<string, Pick<AccountBalance, 'balance' | 'currency'>>()
    for (const s of series) {
      if (s.from > asOf) continue
      out.set(s.id, { currency: s.currency, balance: s.minorAt(asOf, latestAnchor(s.anchors, s.from, asOf)) / unit(s.currency) })
    }
    return out
  }
}

interface Series {
  id: string
  currency: string
  /** Opening instant. */
  from: number
  anchors: readonly Anchor[] | undefined
  /** Balance in minor units at `asOf`, restarting from `base` (undefined = the opening balance). */
  minorAt: (asOf: number, base: Anchor | undefined) => number
}

/** Per tracked account: sorted legs with prefix sums, so any instant reads in O(log n) from any base. */
function ledgerSeries(input: LedgerInput): Series[] {
  const anchors = anchorsByAccount(input)
  const accounts = new Map<string, { open: number; from: number; currency: string; nan: number; legs: { at: number; minor: number }[] }>()
  for (const pm of input.paymentMethods) {
    if (!isTracked(pm)) continue
    const cur = String(pm.currency)
    accounts.set(pm.id, { open: Math.round((pm.openingBalance as number) * unit(cur)), from: new Date(pm.openingAt as string).getTime(), currency: cur, nan: 0, legs: [] })
  }
  walkLegs(input, (accountId, amount, currency, at, _flow, booked) => {
    if (!accountId) return
    const a = accounts.get(accountId)
    if (!a || at <= a.from) return
    const v = legValue(input, amount, currency, a.currency, booked)
    if (v === null) return
    const minor = Math.round(v.value * unit(a.currency))
    // An unreadable instant passes every cut-off in computeBalances, so it is always in.
    if (Number.isNaN(at)) a.nan += minor
    else a.legs.push({ at, minor })
  })
  return [...accounts].map(([id, a]) => {
    a.legs.sort((x, y) => x.at - y.at)
    const sums: number[] = []
    let run = 0
    for (const l of a.legs) sums.push((run += l.minor))
    // Sum of the legs at or before t.
    const upTo = (t: number) => {
      let lo = 0
      let hi = a.legs.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (a.legs[mid].at <= t) lo = mid + 1
        else hi = mid
      }
      return lo ? sums[lo - 1] : 0
    }
    const u = unit(a.currency)
    return {
      id, currency: a.currency, from: a.from, anchors: anchors.get(id),
      minorAt: (asOf, base) => (base ? base.minor(u) + upTo(asOf) - upTo(base.at) : a.open + upTo(asOf)) + a.nan,
    }
  })
}

export interface AnchorGap {
  adjustmentId: string
  accountId: string
  at: number
  /** anchor − balance just before it (§4.1), in account currency. Negative = money left that no row explains. */
  gap: number
}

/**
 * The gap each anchor closes, derived at read time (the stored `delta` is never read): the anchor minus the balance
 * just before it, where "just before" counts every leg at or before the anchor from the previous anchor (or the
 * opening balance). A late report dated before a newer anchor gets its own gap and shifts the newer one's, so the
 * two net to their effect on the latest balance (N7).
 */
export function anchorGaps(input: LedgerInput): AnchorGap[] {
  const out: AnchorGap[] = []
  for (const s of ledgerSeries(input)) {
    const list = s.anchors?.filter((k) => k.at > s.from) ?? []
    const u = unit(s.currency)
    list.forEach((k, i) => {
      const before = s.minorAt(k.at, i ? list[i - 1] : undefined)
      out.push({ adjustmentId: k.id, accountId: s.id, at: k.at, gap: (k.minor(u) - before) / u })
    })
  }
  return out
}
