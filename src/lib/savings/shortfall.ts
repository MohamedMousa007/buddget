import type { Goal, SavingsAccount } from '@/lib/store/types'
import { balancesOverTime, computeBalances, instantOf, minorUnit, type LedgerInput } from '@/lib/accounts/balance'
import { canHoldParts } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'
import { covered, uncoverOrder } from './labels'

/**
 * Shortfall (LOGIC_SPEC §4.2, I-3): an account holds less than what is set aside in it. Everything here is derived from
 * the ledger at read time; nothing is stored except the user's "Keep for now" (a settled prompt under the episode key).
 */
export type GoalRank = Pick<Goal, 'id' | 'priority' | 'status'>

const PREFILL_MS = 7 * 24 * 60 * 60 * 1000

/** short(A) = max(0, held − balance). Card hold-back never counts. 0 for an account with no known balance. */
export function shortOf(input: LedgerInput, accountId: string, asOf: number = Date.now()): number {
  const b = computeBalances(input, asOf).get(accountId)
  return b ? Math.max(0, roundMinor(b.held - b.balance, b.currency)) : 0
}

/**
 * covered(p) for every part (§4.2): what each part in a short account still holds, uncovering in {@link uncoverOrder};
 * a part outside any account, or in a covered one, counts whole. Goal progress reads this from P5 on.
 */
export function coveredParts(input: LedgerInput, goals: readonly GoalRank[], asOf: number = Date.now()): Map<string, number> {
  const balances = computeBalances(input, asOf)
  const out = new Map(input.savingsAccounts.map((p) => [p.id, p.currentBalance]))
  for (const [id, b] of balances) {
    const short = b.held - b.balance
    if (short > 0) for (const [pid, v] of covered(uncoverOrder(input.savingsAccounts, id, goals), short)) out.set(pid, v)
  }
  return out
}

export interface ShortfallEpisode {
  accountId: string
  currency: string
  short: number
  /** The instant of the balance drop (a debit or an anchor) that started this run of being short. */
  openedAt: number
  /** One notice per account per episode: the prompt key "Keep for now" settles. */
  key: string
}

export const shortfallKey = (accountId: string, openedAt: number): string => `shortfall:${accountId}:${openedAt}`

/** Every instant a balance or a part can change at: the ledger rows' own instants and each opening balance. */
function rowInstants(input: LedgerInput): number[] {
  const t: number[] = []
  for (const e of input.expenses) t.push(instantOf(e.occurredAt, e.date))
  for (const i of input.incomeEvents) t.push(instantOf(i.occurredAt, i.receivedDate))
  for (const p of input.debtPayments) t.push(instantOf(p.occurredAt, p.date))
  for (const s of input.savingsTransactions) t.push(instantOf(s.occurredAt, s.date))
  for (const a of input.adjustments) t.push(new Date(a.occurredAt).getTime())
  for (const d of input.debts) if (d.principalAt) t.push(new Date(d.principalAt).getTime())
  for (const m of input.paymentMethods) if (m.openingAt) t.push(new Date(m.openingAt).getTime())
  return t
}

/**
 * The open episode of each short account. It starts at the balance drop that began the current run of being short,
 * read against what was set aside at each instant: today's parts rebuilt from their rows, plus every pocket that has
 * since moved out whole (its rows leave with it, so its `move_in` elsewhere stands in). The key is the same on every
 * device, survives a partial answer, a pocket move or a deeper drop, and is new once the account was covered and goes
 * short again. A run that
 * did not start with a drop of the balance (a rate move on an old row, more set aside) opens no episode: the row still
 * shows "Short X", no notice asks.
 */
export function shortfallEpisodes(input: LedgerInput, asOf: number = Date.now()): ShortfallEpisode[] {
  const balances = computeBalances(input, asOf)
  const short = [...balances.values()].filter((b) => b.held - b.balance >= halfMinor(b.currency))
  if (short.length === 0) return []
  const at = balancesOverTime(input)
  const pairedOut = new Set(input.savingsTransactions.filter((s) => s.source === 'move_out' && s.pairId).map((s) => s.pairId as string))
  const instants = [...new Set(rowInstants(input).filter((t) => Number.isFinite(t) && t <= asOf))].sort((x, y) => y - x)
  const out: ShortfallEpisode[] = []
  for (const b of short) {
    const eps = halfMinor(b.currency)
    const partIds = new Set(input.savingsAccounts.filter((p) => p.heldInPaymentMethodId === b.id).map((p) => p.id))
    const inA = (amount: number, currency: string) => (currency === b.currency ? amount : input.convert(amount, currency, b.currency) ?? 0)
    const deltas = [
      ...input.savingsTransactions
        .filter((s) => partIds.has(s.accountId))
        .map((s) => ({ at: instantOf(s.occurredAt, s.date), v: (s.type === 'deposit' ? 1 : -1) * inA(s.amount, String(s.currency)) })),
      // A whole pocket that left: before it left, its money was set aside here too (an over-count from another
      // account's move can only join two close episodes, never split one).
      ...input.savingsTransactions
        .filter((s) => s.source === 'move_in' && !partIds.has(s.accountId) && !(s.pairId && pairedOut.has(s.pairId)))
        .map((s) => ({ at: instantOf(s.occurredAt, s.date), v: -inA(s.amount, String(s.currency)) })),
    ].sort((x, y) => y.at - x.at)
    let held = b.held
    let d = 0
    let opener: { at: number; balance: number } | null = null
    let found: number | null = null
    for (const t of instants) {
      while (d < deltas.length && deltas[d].at > t) held -= deltas[d++].v
      const balance = at(t).get(b.id)?.balance
      if (balance == null) break
      if (balance - held > -eps) {
        // Covered at t: the run began at the next instant, and counts only if the balance dropped there.
        if (opener && opener.balance < balance - eps) found = opener.at
        break
      }
      opener = { at: t, balance }
    }
    if (found !== null) out.push({ accountId: b.id, currency: b.currency, short: roundMinor(b.held - b.balance, b.currency), openedAt: found, key: shortfallKey(b.id, found) })
  }
  return out
}

/** B's currency per unit of A's: the booked rate of the latest own transfer A→B, else the live rate. Null = no rate. */
export function moveRate(input: LedgerInput, fromId: string, toId: string): number | null {
  const from = input.paymentMethods.find((m) => m.id === fromId)
  const to = input.paymentMethods.find((m) => m.id === toId)
  if (!from || !to) return null
  if (from.currency === to.currency) return 1
  const booked = input.expenses
    .filter((e) => e.toPaymentMethodId && e.toAccountAmount != null && e.currency === from.currency
      && resolveAccountId(e.paymentMethodId, input.paymentMethods) === fromId && resolveAccountId(e.toPaymentMethodId, input.paymentMethods) === toId)
    .sort((x, y) => instantOf(y.occurredAt, y.date) - instantOf(x.occurredAt, x.date))[0]
  const sent = booked ? booked.accountAmount ?? booked.amount : 0
  if (booked && sent > 0) return booked.toAccountAmount! / sent
  return input.convert(1, String(from.currency), String(to.currency))
}

/** "It's in another account", pre-filled: the latest own transfer out of A in the last 7 days (where it went, how much, when). */
export function prefillDestination(input: LedgerInput, fromId: string, asOf: number = Date.now()): { accountId: string; amount: number; currency: string; at: number } | null {
  const latest = input.expenses
    .filter((e) => e.toPaymentMethodId && resolveAccountId(e.paymentMethodId, input.paymentMethods) === fromId)
    .map((e) => ({ accountId: resolveAccountId(e.toPaymentMethodId, input.paymentMethods), amount: e.amount, currency: String(e.currency), at: instantOf(e.occurredAt, e.date) }))
    .filter((x) => x.accountId && x.accountId !== fromId && x.at <= asOf && asOf - x.at <= PREFILL_MS && canHoldParts(input.paymentMethods.find((m) => m.id === x.accountId)))
    .sort((x, y) => y.at - x.at)[0]
  return latest ? { ...latest, accountId: latest.accountId as string } : null
}

export interface MoveStep {
  partId: string
  /** In the part's currency (A's, but for a legacy part). A pocket always moves whole. */
  amount: number
  /** The same money in A's currency: what it answers of the short. */
  amountInAccount: number
  /** The same money in B's currency. */
  amountInB: number
}

/**
 * The moves "It's in another account" makes (§4.2 / §4.8) for `need` (the remaining short, or everything when closing):
 * in uncover order, a goal or Monthly savings part moves what B has free for it; a pocket moves whole only when B has
 * room for all of it, else it is skipped (the user can answer "I spent it" for it). `remaining` is what is left.
 */
export function planMove(input: LedgerInput, goals: readonly GoalRank[], fromId: string, toId: string, need: number, asOf: number = Date.now()): { steps: MoveStep[]; remaining: number } {
  const to = input.paymentMethods.find((m) => m.id === toId)
  const rate = moveRate(input, fromId, toId)
  const fromCur = String(input.paymentMethods.find((m) => m.id === fromId)?.currency ?? '')
  if (!canHoldParts(to) || toId === fromId || !rate || !(need > 0)) return { steps: [], remaining: Math.max(0, need) }
  const b = computeBalances(input, asOf).get(toId)
  let free = Math.max(0, b?.free ?? 0)
  let left = need
  const steps: MoveStep[] = []
  const toCur = String(to.currency)
  for (const p of uncoverOrder(input.savingsAccounts, fromId, goals)) {
    if (left <= halfMinor(fromCur)) break
    const inA = inAccount(input, p, fromCur)
    if (!(inA && inA > 0)) continue
    const whole = !p.goalId && !p.isMonthlySavings
    const amountInAccount = whole ? inA : Math.min(roundMinor(Math.min(inA, left), fromCur), floorMinor(free / rate, fromCur))
    const amountInB = roundMinor(amountInAccount * rate, toCur)
    if (!(amountInAccount > 0) || amountInB > free + halfMinor(toCur)) continue
    const amount = whole || amountInAccount >= inA ? p.currentBalance : p.currentBalance * (amountInAccount / inA)
    steps.push({ partId: p.id, amount, amountInAccount, amountInB })
    free -= amountInB
    left -= amountInAccount
  }
  return { steps, remaining: Math.max(0, roundMinor(left, fromCur)) }
}

/**
 * "I spent it" for `need` (A's currency): spent labels in uncover order (Monthly savings first), a pocket in part if
 * that is all that is left. `amount` is in the part's currency, `amountInAccount` in A's.
 */
export function planSpent(input: Pick<LedgerInput, 'savingsAccounts' | 'paymentMethods' | 'convert'>, goals: readonly GoalRank[], fromId: string, need: number): { partId: string; amount: number; amountInAccount: number }[] {
  const cur = String(input.paymentMethods.find((m) => m.id === fromId)?.currency ?? '')
  const out: { partId: string; amount: number; amountInAccount: number }[] = []
  let left = need
  for (const p of uncoverOrder(input.savingsAccounts, fromId, goals)) {
    if (!(left > 0.0000001)) break
    const inA = inAccount(input, p, cur)
    if (!(inA && inA > 0)) continue
    const amountInAccount = Math.min(inA, left)
    out.push({ partId: p.id, amount: amountInAccount >= inA ? p.currentBalance : p.currentBalance * (amountInAccount / inA), amountInAccount })
    left -= amountInAccount
  }
  return out
}

/** A part's balance in its account's currency, the way computeBalances counts it into held. Null = no rate. */
export function inAccount(input: Pick<LedgerInput, 'convert'>, p: Pick<SavingsAccount, 'currentBalance' | 'currency'>, accountCurrency: string): number | null {
  return p.currency === accountCurrency ? p.currentBalance : input.convert(p.currentBalance, p.currency, accountCurrency)
}

function halfMinor(currency: string): number {
  return 0.5 / minorUnit(currency)
}
function floorMinor(v: number, currency: string): number {
  const u = minorUnit(currency)
  return Math.floor(v * u + 1e-9) / u
}
function roundMinor(v: number, currency: string): number {
  const u = minorUnit(currency)
  return Math.round(v * u) / u
}
