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
 * Strips balance-notification clauses (e.g. "Your available balance is EGP 36,183.18",
 * "Avl Bal is AED 15,234.50") from text, then checks whether any currency+amount
 * remains — a sign the SMS describes an actual transaction, not just a balance query.
 *
 * Prevents mis-rejection of bank notifications that append a balance line to a real
 * transaction (a common HSBC / Emirates NBD / CIB pattern).
 */
function hasNonBalanceAmount(text: string): boolean {
  const stripped = text
    // EN: "Your available/current/account/card balance/limit is EGP 36,183.18"
    .replace(/(?:your\s+)?(?:available|current|account|card)\s+(?:international\s+)?(?:balance|limit)(?:\s+(?:to\s+use\s+)?is\s*|:?\s*)[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi, '')
    // EN compact: "Avl Bal is AED 15,234.50" / "Avl Cr. Limit is AED 30,978.13"
    .replace(/\bavl?\.?\s*(?:cr\.?\s*)?(?:bal(?:ance)?|limit)\s+(?:is\s+)?[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi, '')
    // AR: "الرصيد المتاح / الحالي : EGP 2700.03" and "رصيدك المتاح : ..."
    .replace(/(?:الرصيد|رصيدك?)\s*(?:الحالي|المتاح)\s*:?\s*[A-Z]{0,3}\s*[\d,]+(?:\.\d+)?/gi, '')

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
