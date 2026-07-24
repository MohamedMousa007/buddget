/**
 * Deterministic non-transaction rejector — runs BEFORE any pattern or AI work.
 *
 * Kills the false-flag class where an SMS merely mentions money (telecom quota
 * ads, OTPs, balance inquiries) at ~0ms and zero AI cost. Conservative by
 * design: any message containing a strong transaction verb is NEVER rejected
 * here — it proceeds to the pattern/AI tiers.
 */

import { TXN_KEYWORD_RE } from '@/lib/sms/patterns/currency'

export type NonTransactionReason = 'otp' | 'marketing' | 'balance_only'

/** Strong transaction verbs (EN + AR, Egypt + Gulf) — presence means "let the
 * parsers decide". Shared with the currency vocab so coverage stays in sync. */
const TXN_VERBS = TXN_KEYWORD_RE

const OTP_RE =
  /(\bOTP\b|one[\s-]?time\s+(?:pass(?:word|code)?|pin|code)|verification\s+code|activation\s+code|do\s+not\s+share|never\s+share|رمز\s*التحقق|رمز\s*التفعيل|كلمة\s*(?:السر|المرور)|لا\s*تشارك)/i

const MARKETING_RE =
  /(\boffer\b|\bbundle\b|\bquota\b|\bpromo(?:tion)?\b|\bvoucher\b|\bdiscount\b|%\s*off|recharge\s+now|renew\s+(?:your\s+)?(?:bundle|plan|subscription)|subscribe\s+(?:now|to)|congratulations|you\s+(?:won|have\s+won)|valid\s+until|limited\s+time|عرض|باقة|اشترك|جدد\s*باقتك|خصم\s*\d+\s*%|مبروك|للمزيد\s*اتصل)/i

const BALANCE_ONLY_RE =
  /(available\s+balance|current\s+balance|account\s+balance|balance\s+(?:is|inquiry)|رصيدك\s*(?:الحالي|المتاح)|الرصيد\s*(?:الحالي|المتاح)|استعلام\s*(?:عن\s*)?(?:ال)?رصيد)/i

/**
 * Balance-notification clauses — "Your available balance is EGP 36,183.18",
 * "Avl Bal is AED 15,234.50", "الرصيد المتاح : EGP 2700.03".
 *
 * Exported because two callers need them and must agree:
 *  - `hasNonBalanceAmount` below, so a real transaction that merely *ends* with a balance line
 *    is not mis-rejected as a balance-only SMS.
 *  - the learn-time wrong-token gate, which rejects a generated regex whose amount capture
 *    lands INSIDE one of these clauses. Grabbing the trailing balance instead of the amount is
 *    the single most common systematic misparse, and nearly every message in the corpus ends
 *    with one of these.
 *
 * Note: these carry the `g` flag, so callers that use `.exec`/`.test` in a loop must reset
 * `lastIndex` or use `matchAll`, which does it for them.
 */
export const BALANCE_CLAUSE_PATTERNS: readonly RegExp[] = [
  // EN: "Your available/current/account/card balance/limit is EGP 36,183.18"
  /(?:your\s+)?(?:available|current|account|card)\s+(?:international\s+)?(?:balance|limit)(?:\s+(?:to\s+use\s+)?is\s*|:?\s*)[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi,
  // EN compact: "Avl Bal is AED 15,234.50" / "Avl Cr. Limit is AED 30,978.13"
  /\bavl?\.?\s*(?:cr\.?\s*)?(?:bal(?:ance)?|limit)\s+(?:is\s+)?[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi,
  // AR: "الرصيد المتاح / الحالي : EGP 2700.03" and "رصيدك المتاح : ..."
  /(?:الرصيد|رصيدك?)\s*(?:الحالي|المتاح)\s*:?\s*[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi,
]

/** Character spans of every balance clause in `text`. */
export function balanceClauseSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  for (const re of BALANCE_CLAUSE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (m.index !== undefined) spans.push([m.index, m.index + m[0].length])
    }
  }
  return spans
}

/**
 * Strips balance-notification clauses from text, then checks whether any currency+amount
 * remains — a sign the SMS describes an actual transaction, not just a balance query.
 *
 * Prevents mis-rejection of bank notifications that append a balance line to a real
 * transaction (a common HSBC / Emirates NBD / CIB pattern).
 */
function hasNonBalanceAmount(text: string): boolean {
  const stripped = BALANCE_CLAUSE_PATTERNS.reduce((acc, re) => acc.replace(re, ''), text)

  // Any currency+amount remaining after stripping balance clauses → transaction amount present
  return (
    /(?:EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP|LE)\s*[\d,]+(?:\.\d+)?/i.test(stripped) ||
    /[\d,]+(?:\.\d+)?\s*(?:EGP|SAR|AED|KWD|QAR|OMR|BHD|USD|EUR|GBP|LE)\b/i.test(stripped) ||
    /[\d,]+(?:\.\d+)?\s*جني[هة]/i.test(stripped)
  )
}

/**
 * Returns the rejection reason, or null when the SMS should proceed to the
 * pattern/AI tiers.
 */
export function isNonTransaction(text: string): NonTransactionReason | null {
  // OTPs are distinctive and never describe a completed transaction.
  if (OTP_RE.test(text)) return 'otp'
  // A transaction verb overrides marketing/balance vocabulary —
  // "debited EGP 50 for bundle renewal" is a real fee.
  if (TXN_VERBS.test(text)) return null
  if (MARKETING_RE.test(text)) return 'marketing'
  // Balance-only SMS: only reject if there is no transaction amount outside
  // the balance-notification clause. Banks routinely append "available balance is X"
  // to real transaction alerts — the trailing balance must not cause a false rejection.
  if (BALANCE_ONLY_RE.test(text) && !hasNonBalanceAmount(text)) return 'balance_only'
  return null
}
