/**
 * TypeScript mirror of the on-device OTP rule (android SmsGate.kt, ios SmsOtpGate): one-time-code text is dropped
 * on the phone ONLY when it carries no money movement. Keep the three in step; this one makes the rule testable
 * against the server fixtures. Err on the side of forwarding: the server pre-filter makes the final call.
 */
const OTP = /(?<![a-z])(otp|one[- ]time (?:password|code|pin)|verification code|security code|passcode|do not share|never share|don't share)(?![a-z])/i
const OTP_AR = ['رمز التحقق', 'كلمة المرور المؤقتة', 'رمز التفعيل', 'لا تشارك']
const STRONG = /(?<![a-z])(debited|credited|spent at|purchase of|transaction of|withdrawn|inward transfer)(?![a-z])/i
const STRONG_AR = ['تم خصم', 'تم سحب', 'تم دفع', 'عملية شراء', 'تم إيداع', 'تم إضافة']
const CCY = 'egp|aed|sar|qar|kwd|omr|bhd'
const CURRENCY = new RegExp(`(?:\\d[\\d.,]*\\s?(?:${CCY})(?![a-z]))|(?:(?<![a-z])(?:${CCY})\\s?\\d)`, 'i')
const VERB = /(?<![a-z])(used (?:for|at)|paid|payment|received|refund(?:ed)?|debit(?:ed)?|credit(?:ed)?|purchase|spent|withdr(?:awn|awal)|transfer(?:red)?|deposit(?:ed)?|charged|sent)(?![a-z])/i
const VERB_AR = ['تم الدفع', 'دفع', 'خصم', 'تحويل', 'شراء', 'سحب', 'إيداع', 'استلام', 'استرداد']

export function carriesMoneyMovement(text: string): boolean {
  if (STRONG.test(text) || STRONG_AR.some((w) => text.includes(w))) return true
  const hasAmount = CURRENCY.test(text) || (text.includes('جنيه') && /\d/.test(text))
  return hasAmount && (VERB.test(text) || VERB_AR.some((w) => text.includes(w)))
}

export function shouldDropOtp(text: string): boolean {
  return (OTP.test(text) || OTP_AR.some((w) => text.includes(w))) && !carriesMoneyMovement(text)
}
