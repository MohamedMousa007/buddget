/**
 * Pass-through (relay) money: an amount lands on an account and the same amount leaves it minutes later, or the
 * other way round. It is neither the user's income nor their spending, but only the user can say so, so this module
 * only FINDS the pairs (docs/launch/S1-sms-audit.md 6a.2: label, ask once, never exclude automatically).
 *
 * Pure, and shared by the server (never pair such legs as an own transfer), the app (the "possible pass-through"
 * label) and the gold-set metrics.
 */

export interface MoneyLeg {
  id: string
  /** Whose ledger the leg is in. Legs of different owners never pair. */
  owner: string
  dir: 'in' | 'out'
  amount: number
  currency: string
  /** The account the leg moved on. A leg with no account never pairs: "same account" cannot be shown. */
  account: string | null
  /** Instant of the movement, epoch ms. */
  at: number
  /** The user chose to count this row. It never pairs and is never labelled again. */
  counted?: boolean
}

export interface PassThroughPair { inId: string; outId: string }

/** How far apart the two legs may be. Relayed money leaves within minutes; a wider window starts catching coincidences. */
export const PASS_THROUGH_WINDOW_MS = 10 * 60 * 1000

/**
 * One-to-one pairs of a credit and a debit of the same amount and currency on one account within the window. Each leg
 * is used once and takes the nearest free partner, so three credits and two debits of one amount give two pairs.
 */
export function findPassThroughPairs(legs: readonly MoneyLeg[], windowMs: number = PASS_THROUGH_WINDOW_MS): PassThroughPair[] {
  const buckets = new Map<string, MoneyLeg[]>()
  for (const l of legs) {
    if (l.counted || !l.account || !(l.amount > 0)) continue
    const key = `${l.owner}|${l.account}|${l.currency}|${Math.round(l.amount * 100)}`
    buckets.set(key, [...(buckets.get(key) ?? []), l])
  }
  const pairs: PassThroughPair[] = []
  for (const bucket of buckets.values()) {
    const ins = bucket.filter((l) => l.dir === 'in').sort((a, b) => a.at - b.at)
    const outs = bucket.filter((l) => l.dir === 'out').sort((a, b) => a.at - b.at)
    const used = new Set<string>()
    for (const i of ins) {
      let best: MoneyLeg | null = null
      for (const o of outs) {
        if (used.has(o.id) || Math.abs(o.at - i.at) > windowMs) continue
        if (!best || Math.abs(o.at - i.at) < Math.abs(best.at - i.at)) best = o
      }
      if (best) {
        used.add(best.id)
        pairs.push({ inId: i.id, outId: best.id })
      }
    }
  }
  return pairs
}

/** Ids of every leg that is part of a pair. */
export function findPassThroughLegs(legs: readonly MoneyLeg[], windowMs?: number): Set<string> {
  return new Set(findPassThroughPairs(legs, windowMs).flatMap((p) => [p.inId, p.outId]))
}
