import { it, expect } from 'vitest'
import { nonTransactionReason } from '@/lib/sms/ingestGuards'
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'
const bodies = [
  '482913 is your OTP for payment of EGP 500.00 at Amazon. Do not share it.',
  '482913 is your one-time password for purchase of EGP 500.00 at Amazon',
  'Your OTP for purchase of EGP 500.00 at Amazon is 482913',
  'Use code 482913 to authorize payment of EGP 500.00 to MERCHANT',
  'كود التحقق 482913 لعملية شراء بمبلغ 500.00 جنيه من AMAZON لا تشارك الكود',
]
it('an OTP that also names a payment amount is rejected, whichever side the code is on', () => {
  for (const b of bodies) expect(nonTransactionReason(normalizeSmsText(b), false)).toBe('otp')
})

it('a purchase alert whose footer says never share your OTP is still a transaction', () => {
  const b = 'Purchase of EGP 500.00 at Amazon with card ending 1234, ref 556677. Never share your OTP with anyone.'
  expect(nonTransactionReason(normalizeSmsText(b), false)).toBeNull()
})
