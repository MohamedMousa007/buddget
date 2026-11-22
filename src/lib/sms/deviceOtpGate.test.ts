import { describe, expect, it } from 'vitest'
import { isNonTransaction } from '@/lib/sms/patterns/preFilter'
import { looksLikeBankMoney, shouldDropOnDevice, shouldDropOtp } from './deviceOtpGate'

describe('device OTP gate (mirror of SmsGate.kt / SmsOtpGate)', () => {
  it('forwards the server fixture: a card purchase with a never-share footer', () => {
    const fixture = 'Your card ending 1234 was used for EGP 450.00 at CARREFOUR. Never share your PIN or OTP.'
    expect(isNonTransaction(fixture)).toBeNull()
    expect(shouldDropOtp(fixture)).toBe(false)
  })
  it('forwards Arabic and paid/received wording next to an amount', () => {
    expect(shouldDropOtp('You paid EGP 90.00 at Discount Mart. Do not share your PIN.')).toBe(false)
    expect(shouldDropOtp('تم الدفع 150 جنيه لدى متجر. لا تشارك رمز التحقق')).toBe(false)
  })
  it('drops real one-time codes that carry no money movement', () => {
    expect(shouldDropOtp('Your OTP is 123456. Do not share it.')).toBe(true)
    expect(shouldDropOtp('Never share your PIN or OTP with anyone. Code 482913')).toBe(true)
    expect(shouldDropOtp('رمز التحقق الخاص بك هو 4821')).toBe(true)
  })
  it('forwards USD, EUR, GBP, SR and glued amounts next to a verb', () => {
    expect(shouldDropOtp('Card approved for USD 20 at Shop. Never share your OTP.')).toBe(false)
    expect(shouldDropOtp('You paid EUR 12.50 at Shop. Never share your OTP.')).toBe(false)
    expect(shouldDropOtp('You paid GBP10 at Shop. Never share your OTP.')).toBe(false)
    expect(shouldDropOtp('You paid SR 100.00 at Shop. Never share your OTP.')).toBe(false)
    expect(shouldDropOtp('You paid 100SR at Shop. Never share your OTP.')).toBe(false)
  })
  it('reads Arabic-Indic and Eastern Arabic-Indic amounts', () => {
    expect(shouldDropOtp('You paid SAR ١٢٣٫٥٠ at Shop. Never share your OTP.')).toBe(false)
    expect(shouldDropOtp('You paid ۱۲۳ EGP at Shop. Never share your OTP.')).toBe(false)
  })
  it('does not read a code inside a word as an amount', () => {
    expect(shouldDropOtp('Hi Sarah, your OTP is 123456. Never share it. Paid')).toBe(true)
  })
  it('never drops text without OTP wording', () => {
    expect(shouldDropOtp('EGP 100 debited at Shop')).toBe(false)
  })
})

describe('iOS bank-money gate (mirror of SmsOtpGate.looksLikeBankMoney)', () => {
  it('keeps bank texts the stricter money-movement rule missed', () => {
    expect(looksLikeBankMoney('Instant transfer of EGP 2,500.00 to your account 1234 from AHMED')).toBe(true)
    expect(looksLikeBankMoney('تم تحويل مرتب 15000 جنيه على حسابك')).toBe(true)
  })
  it('drops personal texts that only contain a 0', () => {
    expect(looksLikeBankMoney('See you at 10:30 tomorrow')).toBe(false)
    expect(looksLikeBankMoney('Call me on 0100 123 4567')).toBe(false)
  })
})

// iOS catch-all trigger: shapes taken from 120 days of real (masked) history, digits and names invented.
describe('iOS catch-all device rule (mirror of SmsOtpGate.shouldDrop)', () => {
  it.each([
    ['card purchase with a never-share footer', 'Your card ending 1234 was used for EGP 450.00 at CARREFOUR. Never share your PIN or OTP.'],
    ['Arabic payment with a verification-code footer', 'تم الدفع 150 جنيه لدى متجر. لا تشارك رمز التحقق'],
    ['wallet receipt that ends with a cashback line', 'تم استلام 500 جنيه من 01012345678 على فودافون كاش. حول دلوقتي واكسب كاش باك'],
    ['Saudi mada purchase', 'شراء PoS عبر:1234;مدى-أثير بـSAR 25 لـAl Jeri 1/2/26 10:30'],
    ['HSBC decline (booked as a zero row on purpose)', 'From HSBC: Transaction of EGP 120.00 from SHOP using HSBC card ending with *** 1234 was declined.'],
    ['a plain debit', 'EGP 100 debited at Shop'],
  ])('keeps %s', (_name, text) => {
    expect(shouldDropOnDevice(text)).toBe(false)
  })

  it.each([
    ['a one-time code for a purchase', 'OTP 482913 for purchase of EGP 500 at Amazon. Valid for 5 minutes.'],
    ['an Arabic code to complete a purchase', 'رمز التحقق 4821 لإتمام عملية شراء بقيمة 300 جنيه'],
    ['a data bundle offer', 'خصم كبير على باقة النت، Plus5 الشهريه بـ50 جنيه بدل 70 لمدة شهرين'],
    ['an English offer with prices', 'Special limited time offer!! Save 20 SAR and enjoy benefits for only 49 SAR'],
    ['a prize text', 'مبروك كسبت 5 وحدة هدية! رد ب 1 الآن'],
    ['a minutes transfer', 'تم تحويل 30 دقيقة بنجاح من 01012345678'],
  ])('drops %s', (_name, text) => {
    expect(shouldDropOnDevice(text)).toBe(true)
  })

  it('drops anything from a marketing sender unless money clearly moved', () => {
    expect(shouldDropOnDevice('New arrivals this week, visit us', 'PROMO')).toBe(true)
    expect(shouldDropOnDevice('EGP 100 debited at Shop', 'PROMO')).toBe(false)
  })
})
