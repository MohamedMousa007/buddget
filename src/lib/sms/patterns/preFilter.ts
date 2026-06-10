/**
 * Deterministic non-transaction rejector — runs BEFORE any pattern or AI work.
 *
 * Kills the false-flag class where an SMS merely mentions money (telecom quota
 * ads, OTPs, balance inquiries) at ~0ms and zero AI cost. Conservative by
 * design: any message containing a strong transaction verb is NEVER rejected
 * here — it proceeds to the pattern/AI tiers.
 */

export type NonTransactionReason = 'otp' | 'marketing' | 'balance_only'

/** Strong transaction verbs — presence means "let the parsers decide". */
const TXN_VERBS =
  /(debited|credited|withdrawn|charged|spent\s+at|purchase\s+(?:of|at)|transferred|payment\s+(?:of|received)|received\s+from|paid\s+to|تم\s*خصم|تم\s*سحب|تم\s*دفع|تم\s*إيداع|تم\s*استلام|تم\s*تحويل|تم\s*إضافة|عملية\s*شراء)/i

const OTP_RE =
  /(\bOTP\b|one[\s-]?time\s+(?:pass(?:word|code)?|pin|code)|verification\s+code|activation\s+code|do\s+not\s+share|never\s+share|رمز\s*التحقق|رمز\s*التفعيل|كلمة\s*(?:السر|المرور)|لا\s*تشارك)/i

const MARKETING_RE =
  /(\boffer\b|\bbundle\b|\bquota\b|\bpromo(?:tion)?\b|\bvoucher\b|\bdiscount\b|%\s*off|recharge\s+now|renew\s+(?:your\s+)?(?:bundle|plan|subscription)|subscribe\s+(?:now|to)|congratulations|you\s+(?:won|have\s+won)|valid\s+until|limited\s+time|عرض|باقة|اشترك|جدد\s*باقتك|خصم\s*\d+\s*%|مبروك)/i

const BALANCE_ONLY_RE =
  /(available\s+balance|current\s+balance|account\s+balance|balance\s+(?:is|inquiry)|رصيدك\s*(?:الحالي|المتاح)|استعلام\s*(?:عن\s*)?(?:ال)?رصيد)/i

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
  if (BALANCE_ONLY_RE.test(text)) return 'balance_only'
  return null
}
