import type { Goal, SavingsAccount } from '@/lib/store/types'
import { computeBalances, instantOf, type LedgerInput } from '@/lib/accounts/balance'
import { partsOfGoal } from '@/lib/goals/computeGoalProgress'
import { coveredParts } from '@/lib/savings/shortfall'
import { capsOf, type PlanContext } from './proposal'

/** Rates as stored on a month-end row: base per one unit of each currency ({ USD: 50 } for an EGP user). */
export type BaseRates = Record<string, number>

export function ratesConverter(rates: BaseRates, base: string): (amount: number, from: string, to: string) => number | null {
  const r = (c: string) => (c === base ? 1 : rates[c])
  return (amount, from, to) => {
    if (from === to) return amount
    const f = r(from)
    const t = r(to)
    return f && t ? (amount * f) / t : null
  }
}

/** Each part's balance at `asOf`: its balance now minus its rows after that instant (held at the cycle end, N9). */
export function partsAt(ledger: Pick<LedgerInput, 'savingsAccounts' | 'savingsTransactions'>, asOf: number): SavingsAccount[] {
  const later = new Map<string, number>()
  for (const t of ledger.savingsTransactions) {
    if (instantOf(t.occurredAt, t.date) <= asOf) continue
    later.set(t.accountId, (later.get(t.accountId) ?? 0) + (t.type === 'deposit' ? t.amount : -t.amount))
  }
  return ledger.savingsAccounts.map((p) => (later.has(p.id) ? { ...p, currentBalance: p.currentBalance - later.get(p.id)! } : p))
}

export interface ContextInput {
  userId: string
  base: string
  rates: BaseRates
  ledger: LedgerInput
  goals: readonly Goal[]
  /** The cycle's end instant and now (ms). */
  cycleEnd: number
  now: number
}

/**
 * The placement context at one moment: caps from free(A, C.end) (parts as they stood then) and free(A, now), the
 * live parts and goals, and goal progress as Σ covered parts in the goal's currency. Gold has no server price, so a
 * gold part adds nothing here (a goal is never completed on a guess).
 */
export function planContext(i: ContextInput): PlanContext {
  const convert = ratesConverter(i.rates, i.base)
  const ledger = { ...i.ledger, convert }
  const atEnd = computeBalances({ ...ledger, savingsAccounts: partsAt(ledger, i.cycleEnd) }, i.cycleEnd)
  const now = computeBalances(ledger, i.now)
  const covered = coveredParts(ledger, i.goals, i.now)
  const parts = i.ledger.savingsAccounts
  return {
    userId: i.userId, base: i.base, convert, parts, goals: i.goals,
    accounts: capsOf(atEnd, now, i.ledger.paymentMethods),
    progress: (g) => partsOfGoal(g, parts).reduce((s, p) => s + (convert(covered.get(p.id) ?? p.currentBalance, p.currency, g.currency) ?? 0), 0),
  }
}

export const heldByAccount = (parts: readonly SavingsAccount[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const p of parts) if (p.heldInPaymentMethodId) out[p.heldInPaymentMethodId] = Math.round(((out[p.heldInPaymentMethodId] ?? 0) + p.currentBalance) * 1000) / 1000
  return out
}
