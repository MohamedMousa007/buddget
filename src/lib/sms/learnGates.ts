/**
 * Learn-time gates — reject a bad regex BEFORE it is ever stored.
 *
 * Everything else in the funnel (quarantine, failure signals, adjudication, retirement) detects
 * a bad template *after* it has produced wrong transactions. These gates prevent it, for free,
 * deterministically, with no user and no AI call. They are the highest-value part of the design.
 *
 * The hole they close: `generateMatchingRegex` validated only `re.test(message)` — that the
 * regex MATCHES. It never checked that the capture groups produce the values the AI extracted,
 * so a regex whose amount group grabs the trailing "available balance" passed validation and
 * was stored as a global, fully-trusted template.
 */
import { isSafeRegexPattern } from '@/lib/sms/safeRegex'
import { balanceClauseSpans } from '@/lib/sms/patterns/preFilter'
import { applyMappingRules, last4Agrees, type MappingRules } from '@/lib/sms/templateApply'
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'
import { perUserLiteralKinds } from '@/lib/sms/literalLeaks'
import { replayCandidate, type ReplayCase } from '@/lib/sms/replayHarness'
import { isSmsExpenseKind } from '@/lib/sms/smsKinds'

export type GateFailure =
  | 'gate_no_match'
  | 'gate_amount_mismatch'
  | 'gate_currency_mismatch'
  | 'gate_last4_mismatch'
  | 'gate_wrong_token_balance'
  | 'gate_capture_unsound'
  | 'gate_regex_too_greedy'
  | 'gate_regex_unsafe'
  | 'gate_per_user_literal'
  | 'gate_replay_regression'
  | 'gate_unknown_kind'

export type GateResult = { ok: true } | { ok: false; status: GateFailure; detail?: string }

/** Amounts agree to the cent; anything looser would let an off-by-a-digit capture through. */
const AMOUNT_EPSILON = 0.005

/**
 * A capture longer than this is not a field, it is a swallowed sentence — the signature of an
 * unbounded wildcard that will grab neighbouring text on the next SMS.
 */
const MAX_CAPTURE_CHARS = 120

/**
 * A GREEDY unbounded wildcard outside a character class — `.+` / `.*` but not `.+?` / `.*?`.
 *
 * Greedy is the dangerous form: in `(.+)\s+EGP\s+([\d,]+)` the `.+` runs to the LAST "EGP" in
 * the message, which on a body ending in "available balance is EGP 3,571.53" means the amount
 * group captures the balance. Lazy (`.+?`) stops at the first delimiter and is what the real
 * corpus templates use, so it stays allowed.
 */
const UNBOUNDED_WILDCARD = /(?<!\[)\.[*+](?!\?)/

/** A currency code inside a value capture means the group boundary is in the wrong place. */
const CURRENCY_IN_CAPTURE = /\b(?:EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP)\b/i

/** What the AI said this SMS contains — the reference the regex must reproduce. */
export interface ExpectedFields {
  amount: number | null
  currency: string | null
  detectedAccountLast4: string | null
}

/**
 * Runs every gate over a freshly generated regex against the SMS it was generated from.
 *
 * `L1` is the load-bearing one: it re-applies the regex through the SAME extraction path
 * production uses (`applyMappingRules`) and requires the values to match the AI's. A regex that
 * matches but captures the wrong groups fails here instead of in a user's ledger.
 */
export function runLearnGates(
  rawMessage: string,
  regexPattern: string,
  rules: MappingRules,
  expected: ExpectedFields,
  opts: { receivedAt?: string | null; replay?: readonly ReplayCase[] } = {},
): GateResult {
  // The learner works on the normalised text (no bidi marks, ASCII digits) so spans and balance
  // clauses are measured on the same string the regex ran against.
  const message = normalizeSmsText(rawMessage)
  if (!isSafeRegexPattern(regexPattern)) {
    return { ok: false, status: 'gate_regex_unsafe', detail: 'nested quantifier or overlong pattern' }
  }

  if (!isSmsExpenseKind(rules.kind)) return { ok: false, status: 'gate_unknown_kind', detail: String(rules.kind).slice(0, 40) }

  // ---- L4: greediness -----------------------------------------------------
  // Checked first because it is a property of the regex alone and needs no match.
  if (UNBOUNDED_WILDCARD.test(regexPattern)) {
    return { ok: false, status: 'gate_regex_too_greedy', detail: 'unbounded . wildcard' }
  }

  // ---- L1: value verification --------------------------------------------
  const got = applyMappingRules(message, regexPattern, rules, { receivedAt: opts.receivedAt })
  if (!got) return { ok: false, status: 'gate_no_match' }

  // N14: a regex that embeds this user's own account/phone/name/amount serves nobody else.
  const literals = perUserLiteralKinds(regexPattern, { amount: expected.amount, last4: expected.detectedAccountLast4 })
  if (literals.length) return { ok: false, status: 'gate_per_user_literal', detail: literals.join(',') }

  if (expected.amount != null && Math.abs(got.amount - expected.amount) > AMOUNT_EPSILON) {
    return {
      ok: false,
      status: 'gate_amount_mismatch',
      detail: `regex=${got.amount} ai=${expected.amount}`,
    }
  }
  // Only compare a currency the regex actually claims to capture; a literal mapping is the AI's
  // own value and cannot disagree with itself.
  if (expected.currency && got.currency && got.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return {
      ok: false,
      status: 'gate_currency_mismatch',
      detail: `regex=${got.currency} ai=${expected.currency}`,
    }
  }
  if (expected.detectedAccountLast4 && got.last4 && !last4Agrees(got.last4, expected.detectedAccountLast4)) {
    return {
      ok: false,
      status: 'gate_last4_mismatch',
      detail: `regex=${got.last4} ai=${expected.detectedAccountLast4}`,
    }
  }

  // ---- L2: wrong-token ----------------------------------------------------
  // Position, not value: an amount that legitimately equals the balance is fine, an amount
  // captured from INSIDE the balance clause is not. No balance is stored or tracked — this
  // reads one message and forgets it.
  const amountSpan = got.spans[rules.amount.group]
  if (amountSpan) {
    for (const [start, end] of balanceClauseSpans(message)) {
      if (amountSpan[0] >= start && amountSpan[1] <= end) {
        return { ok: false, status: 'gate_wrong_token_balance' }
      }
    }
  }

  // ---- L3: capture sanity -------------------------------------------------
  if (!(got.amount > 0)) return { ok: false, status: 'gate_capture_unsound', detail: 'amount <= 0' }
  if (rules.last4 && got.last4 && !/^\d{4}$/.test(got.last4)) {
    return { ok: false, status: 'gate_capture_unsound', detail: 'last4 not 4 digits' }
  }
  // LF2: a year-less or unusual date is fine (production falls back to the arrival date); only a
  // datetime group that captured no digits at all points at the wrong token.
  if (rules.datetime && got.txDay === null && !/\d/.test(got.rawDatetime ?? '')) {
    return { ok: false, status: 'gate_capture_unsound', detail: 'datetime group has no digits' }
  }

  for (const [groupKey, span] of Object.entries(got.spans)) {
    if (Number(groupKey) === 0) continue // group 0 is the whole match
    if (span[1] - span[0] > MAX_CAPTURE_CHARS) {
      return { ok: false, status: 'gate_capture_unsound', detail: 'capture too long' }
    }
  }
  // A merchant capture that swallowed the currency has its boundary in the wrong place.
  if (rules.merchant && got.merchant && CURRENCY_IN_CAPTURE.test(got.merchant)) {
    return { ok: false, status: 'gate_capture_unsound', detail: 'currency inside merchant' }
  }
  if (got.merchant && /[\r\n]/.test(got.merchant)) {
    return { ok: false, status: 'gate_capture_unsound', detail: 'newline inside merchant' }
  }

  if (opts.replay?.length) {
    const replay = replayCandidate({ regex: regexPattern, rules }, opts.replay)
    if (!replay.ok) return { ok: false, status: 'gate_replay_regression', detail: `${replay.regressions.length} regressed: ${replay.regressions.map((r) => r.id).slice(0, 3).join(',')}` }
  }

  return { ok: true }
}
