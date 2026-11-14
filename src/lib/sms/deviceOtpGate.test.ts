import { describe, expect, it } from 'vitest'
import { isNonTransaction } from '@/lib/sms/patterns/preFilter'
import { shouldDropOtp } from './deviceOtpGate'

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
