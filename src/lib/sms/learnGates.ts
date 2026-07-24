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
import { balanceClauseSpans } from '@/lib/sms/patterns/preFilter'
import { applyMappingRules, type MappingRules } from '@/lib/sms/templateApply'

export type GateFailure =
  | 'gate_no_match'
  | 'gate_amount_mismatch'
  | 'gate_currency_mismatch'
  | 'gate_last4_mismatch'
  | 'gate_wrong_token_balance'
  | 'gate_capture_unsound'
  | 'gate_regex_too_greedy'

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
  message: string,
  regexPattern: string,
  rules: MappingRules,
  expected: ExpectedFields,
): GateResult {
  // ---- L4: greediness -----------------------------------------------------
  // Checked first because it is a property of the regex alone and needs no match.
  if (UNBOUNDED_WILDCARD.test(regexPattern)) {
    return { ok: false, status: 'gate_regex_too_greedy', detail: 'unbounded . wildcard' }
  }

  // ---- L1: value verification --------------------------------------------
  const got = applyMappingRules(message, regexPattern, rules)
  if (!got) return { ok: false, status: 'gate_no_match' }

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
  if (expected.detectedAccountLast4 && got.last4 && got.last4 !== expected.detectedAccountLast4) {
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
  if (rules.datetime && got.txDay === null) {
    return { ok: false, status: 'gate_capture_unsound', detail: 'datetime group unparseable' }
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

  return { ok: true }
}
