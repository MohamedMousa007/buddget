/**
 * Evidence for promoting a learned template (docs/launch/S1-sms-audit.md 6c).
 *
 * A template that is about to parse for EVERY user is replayed over every stored message: the ones it should read
 * and the ones it must not (OTPs, marketing, balance-only notices, sibling formats of the same bank). Where it
 * matches a message another tier parsed, its amount, direction, currency and account digits are compared with that
 * reading; "it matched" alone is not evidence. Messages from users who never contributed to the template are the
 * held-out split.
 *
 * Pure. The messages come from a local export that is never committed (raw text exists only for recent rows; older
 * rows are masked shapes, on which amounts and digits cannot be compared and only match, direction and currency are).
 */
import { applyMappingRules, type MappingRules } from '@/lib/sms/templateApply'
import { materializeShape } from '@/lib/sms/replayHarness'
import { guardDirection } from '@/lib/sms/directionGuard'
import { normalizeDigits } from '@/lib/sms/normalizeDigits'
import { tailsMatch } from '@/lib/accounts/identity/accountRef'
import type { SmsExpenseKind } from '@/lib/sms/createSmsExpense'

export interface ReplayTemplate {
  id: string; sender: string | null; regex: string; rules: MappingRules; tier: string; status: string; ai_enabled: boolean
  match_count: number; users: number; failures: number; hard_fail: boolean | null; age_days: number
  contributors: string[] | null
}
export interface ReplayRow {
  id: string; u: string; raw: string | null; mb: string | null; ok: boolean; st: string; fc: string | null; pm: string | null
  k: string | null; a: number | null; c: string | null; t: string | null; tid: string | null; dup: boolean
}

export interface TemplateEvidence {
  id: string
  /** Messages it matched that some tier parsed as a transaction. */
  matched: number
  /** Of those, messages from users who never contributed to it (the held-out split). */
  heldOutUsers: number
  /** Of those, messages another tier parsed (the template's own rows prove nothing about it). */
  independent: number
  /** Independent matches where the raw text was available, so amount and digits could be compared. */
  comparedExact: number
  /** Messages it matched that were NOT transactions. Any is disqualifying. */
  falsePositives: number
  disagreements: { amount: number; direction: number; currency: number; digits: number }
  /** Same direction but a different kind than the other tier chose (reported, not disqualifying). */
  kindDiffers: number
}

const CREDIT = new Set(['income', 'instant_transfer_in', 'refund'])
const DEBIT = new Set(['purchase', 'online_purchase', 'atm_withdrawal', 'instant_transfer_out', 'cc_payoff', 'installment_payment', 'fee'])
const direction = (kind: string | null): 'credit' | 'debit' | null => (kind && CREDIT.has(kind) ? 'credit' : kind && DEBIT.has(kind) ? 'debit' : null)

export function replayTemplate(tpl: ReplayTemplate, rows: readonly ReplayRow[]): TemplateEvidence {
  const ev: TemplateEvidence = {
    id: tpl.id, matched: 0, heldOutUsers: 0, independent: 0, comparedExact: 0, falsePositives: 0,
    disagreements: { amount: 0, direction: 0, currency: 0, digits: 0 }, kindDiffers: 0,
  }
  const contributors = new Set(tpl.contributors ?? [])
  for (const r of rows) {
    if (r.dup) continue
    const text = r.raw ?? (r.mb ? materializeShape(r.mb) : null)
    if (!text) continue
    let got: ReturnType<typeof applyMappingRules> = null
    try { got = applyMappingRules(text, tpl.regex, tpl.rules) } catch { got = null }
    if (!got) continue
    if (!r.ok || !r.k) {
      // A row that failed for a reason other than "not a transaction" (a timeout, a failed insert) is no verdict.
      if (r.st === 'rejected' && (r.fc === 'not_transaction' || r.fc === 'known_non_transaction')) ev.falsePositives++
      continue
    }
    ev.matched++
    if (!contributors.has(r.u)) ev.heldOutUsers++
    if (r.tid === tpl.id) continue
    ev.independent++
    // The template's kind as dispatch would apply it: the ledger-sign guard runs on every tier.
    const kind = guardDirection(got.kind as SmsExpenseKind, normalizeDigits(text))
    const mine = direction(kind)
    const theirs = direction(r.k)
    if (mine && theirs && mine !== theirs) ev.disagreements.direction++
    else if (kind !== r.k) ev.kindDiffers++
    if (got.currency && r.c && got.currency.toUpperCase() !== r.c.toUpperCase()) ev.disagreements.currency++
    if (r.raw) {
      ev.comparedExact++
      if (r.a != null && Math.abs(got.amount - r.a) > 0.005) ev.disagreements.amount++
      if (got.last4 && r.t && !tailsMatch(got.last4, r.t) && got.last4 !== r.t) ev.disagreements.digits++
    }
  }
  return ev
}

/** Fewest independent agreeing readings before a template may parse for everyone. */
export const MIN_INDEPENDENT = 3

/** A template younger than this has not seen a month-end, a statement cycle or a format change yet. */
export const MIN_AGE_DAYS = 14

export type ReplayVerdict = { pass: true } | { pass: false; reason: string }

/**
 * The replay gate: no false positive, no disagreement on amount, direction, currency or digits, the same kind as the
 * other tier, enough independent readings, enough of them on raw text (where amount and digits are comparable), and
 * old enough.
 */
export function replayVerdict(tpl: ReplayTemplate, ev: TemplateEvidence): ReplayVerdict {
  if (tpl.status !== 'active' || !tpl.ai_enabled) return { pass: false, reason: 'not active' }
  if (tpl.hard_fail || tpl.failures > 0) return { pass: false, reason: 'has recorded failures' }
  if (ev.falsePositives > 0) return { pass: false, reason: `matched ${ev.falsePositives} non-transaction message(s)` }
  const d = ev.disagreements
  if (d.amount + d.direction + d.currency + d.digits > 0) return { pass: false, reason: `disagrees with another tier (amount ${d.amount}, direction ${d.direction}, currency ${d.currency}, digits ${d.digits})` }
  if (ev.kindDiffers > 0) return { pass: false, reason: `another tier chose a different kind ${ev.kindDiffers} time(s)` }
  if (ev.independent < MIN_INDEPENDENT) return { pass: false, reason: `only ${ev.independent} independent reading(s)` }
  if (ev.comparedExact < MIN_INDEPENDENT) return { pass: false, reason: `amount and digits compared on only ${ev.comparedExact} message(s)` }
  if (tpl.age_days < MIN_AGE_DAYS) return { pass: false, reason: `only ${tpl.age_days} day(s) old` }
  return { pass: true }
}
