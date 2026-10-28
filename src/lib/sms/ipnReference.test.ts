import { describe, expect, it } from 'vitest'
import { extractIpnReference } from './dispatch'

describe('extractIpnReference (N20)', () => {
  it('does not take a date as the reference', () => {
    expect(extractIpnReference('Reference: 20261027 for rent')).toBeNull()
    expect(extractIpnReference('Ref 27102026 sent')).toBeNull()
  })
  it('still takes a real reference', () => {
    expect(extractIpnReference('Reference: 53817294')).toBe('53817294')
    expect(extractIpnReference('Ref# a1b2c3d4')).toBe('a1b2c3d4')
  })
})

import { isNonTransaction } from './patterns/preFilter'

describe('OTP pre-filter (N21)', () => {
  it('keeps a purchase that prints an auth code beside the anti-fraud footer', () => {
    expect(isNonTransaction('Purchase of EGP 120.00 at SHOP. Auth code 123456. Never share your OTP.')).toBeNull()
  })
  it('still rejects a real OTP', () => {
    expect(isNonTransaction('Your OTP is 123456. Do not share it.')).toBe('otp')
  })
})
