/**
 * TypeScript mirror of the on-device OTP rule (android SmsGate.kt, ios SmsOtpGate): one-time-code text is dropped
 * on the phone ONLY when it carries no money movement. Keep the three in step; this one makes the rule testable
 * against the server fixtures. Err on the side of forwarding: the server pre-filter makes the final call.
 *
 * The currency list and the digit class must match android/app/src/main/java/app/buddget/SmsGate.kt and
 * ios/App/App/CatchBankSmsIntent.swift (SmsOtpGate); edit all three together.
 */
const OTP = /(?<![a-z])(otp|one[- ]time (?:password|code|pin)|verification code|security code|passcode|do not share|never share|don't share)(?![a-z])/i
const OTP_AR = ['رمز التحقق', 'كلمة المرور المؤقتة', 'رمز التفعيل', 'لا تشارك']
const STRONG = /(?<![a-z])(debited|credited|spent at|purchase of|transaction of|withdrawn|inward transfer)(?![a-z])/i
const STRONG_AR = ['تم خصم', 'تم سحب', 'تم دفع', 'عملية شراء', 'تم إيداع', 'تم إضافة']
const CCY = 'egp|aed|sar|qar|kwd|omr|bhd|usd|eur|gbp|l\\.?e|sr'
const DIGITS = '0-9\\u0660-\\u0669\\u06F0-\\u06F9'
const CURRENCY = new RegExp(
  `(?:[${DIGITS}][${DIGITS}.,]*\\s?(?:${CCY}|ج\\.?م)(?![a-z]))|(?:(?<![a-z])(?:${CCY}|e£|ج\\.?م)\\s?[${DIGITS}])`,
  'i',
)
const VERB = /(?<![a-z])(used (?:for|at)|approved|authori[sz]ed|paid|payment|received|refund(?:ed)?|debit(?:ed)?|credit(?:ed)?|purchase|spent|withdr(?:awn|awal)|transfer(?:red)?|deposit(?:ed)?|charged|sent)(?![a-z])/i
const VERB_AR = ['تم الدفع', 'دفع', 'خصم', 'تحويل', 'شراء', 'سحب', 'إيداع', 'استلام', 'استرداد']

const hasAmount = (text: string) => CURRENCY.test(text) || (text.includes('جنيه') && /\d/.test(text))

export function carriesMoneyMovement(text: string): boolean {
  if (STRONG.test(text) || STRONG_AR.some((w) => text.includes(w))) return true
  return hasAmount(text) && (VERB.test(text) || VERB_AR.some((w) => text.includes(w)))
}

/** iOS only (SmsOtpGate.looksLikeBankMoney): keyword automations ("جم" matches everyday words too), so this decides what leaves the phone. */
export function looksLikeBankMoney(text: string): boolean {
  return hasAmount(text) || carriesMoneyMovement(text)
}

/** One-time-code boilerplate ("never share your OTP") with no money movement. Real receipts carry that footer too. */
export function shouldDropOtp(text: string): boolean {
  return (OTP.test(text) || OTP_AR.some((w) => text.includes(w))) && !carriesMoneyMovement(text)
}

// iOS catch-all trigger (2026-11-22): every SMS reaches the action, so the phone drops what is never a transaction.
// Measured on 120 days of sms_parse_log (1,000+ messages): keeps all 778 booked texts and cuts 65% of the junk that
// reached the server. Keep in step with SmsOtpGate.shouldDrop in ios/App/App/CatchBankSmsIntent.swift.
const CODE_WORD = /(?<![a-z])(otp|one[- ]time|verification|code|passcode|password)(?![a-z])/i
const CODE_WORD_AR = ['رمز', 'كود', 'كلمة المرور']
// What a one-time code says and a receipt never does: it expires, or it completes an action still pending.
const CODE_CONTEXT = /(valid (?:for|until|till)|expires?|expiry|to (?:complete|confirm|authori[sz]e|verify|proceed)|is your)/i
const CODE_CONTEXT_AR = ['صالح', 'ينتهي', 'لإتمام', 'لتأكيد', 'لإكمال', 'للتحقق']
const PROMO = /(?<![a-z])(promo(?:tion)?|promo code|coupon|discount|\d+\s?% ?off|offer|cash ?back|for only|save \d|subscribe|win|winner|free gift|flash sale|unsubscribe|reply stop|bundle)(?![a-z])/i
// "كاش باك" and "تكسب" are left out on purpose: real wallet receipts end with a cashback line (10 booked texts).
const PROMO_AR = ['عرض', 'كوبون', 'اشترك', 'للإلغاء', 'مبروك', 'كسبت', 'باقة', 'للتفعيل', 'ميجا', 'دقيقة', 'هدية', 'فرصتك']
const PROMO_SENDERS = new Set(['ads', 'promo', 'promos', 'offers', 'offer', 'marketing', 'deals', 'sale'])
const DONE_TRANSFER = /(?<![a-z])(received|transferred)(?![a-z])/i
const DONE_TRANSFER_AR = ['تم تحويل', 'تم استلام', 'استلمت']

const any = (text: string, words: string[]) => words.some((w) => text.includes(w))

/** True when this SMS stays on the phone. `sender` is the Shortcut's Sender (empty on older automations). */
export function shouldDropOnDevice(text: string, sender = ''): boolean {
  if ((CODE_WORD.test(text) || any(text, CODE_WORD_AR)) && (CODE_CONTEXT.test(text) || any(text, CODE_CONTEXT_AR))) return true
  if (shouldDropOtp(text)) return true
  const promoSender = PROMO_SENDERS.has(sender.toLowerCase().replace(/[^a-z]/g, ''))
  if (!promoSender && !PROMO.test(text) && !any(text, PROMO_AR)) return false
  const strong = STRONG.test(text) || any(text, STRONG_AR)
  return !(strong || (hasAmount(text) && (DONE_TRANSFER.test(text) || any(text, DONE_TRANSFER_AR))))
}
