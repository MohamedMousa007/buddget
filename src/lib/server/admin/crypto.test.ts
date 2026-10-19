import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, otpauthUri, totpCode, verifyTotp } from './totp'
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  passwordProblem,
  verifyPassword,
} from './crypto'

// RFC 6238 appendix B: SHA-1 secret "12345678901234567890", 8 digits; we use the last 6.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))

describe('totp', () => {
  it('matches the RFC 6238 vectors', () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082')
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804')
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037')
  })

  it('round-trips base32', () => {
    const raw = Buffer.from([1, 2, 3, 250, 251, 252, 0, 9])
    expect(base32Decode(base32Encode(raw))).toEqual(raw)
  })

  it('accepts one step of drift and refuses a replayed step', () => {
    const t = 1111111109 * 1000
    const step = Math.floor(t / 1000 / 30)
    expect(verifyTotp(RFC_SECRET, '081804', t)).toBe(step)
    expect(verifyTotp(RFC_SECRET, '081804', t + 30_000)).toBe(step)
    expect(verifyTotp(RFC_SECRET, '081804', t + 90_000)).toBeNull()
    expect(verifyTotp(RFC_SECRET, '081804', t, step)).toBeNull()
    expect(verifyTotp(RFC_SECRET, 'abcdef', t)).toBeNull()
  })

  it('builds an otpauth uri', () => {
    expect(otpauthUri('ABC', 'a@b.co')).toContain('secret=ABC')
  })
})

describe('crypto', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Correct-Horse-9')
    expect(await verifyPassword('Correct-Horse-9', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('encrypts secrets reversibly and never deterministically', () => {
    process.env.ADMIN_AUTH_SECRET = 'test-secret'
    const a = encryptSecret('JBSWY3DPEHPK3PXP')
    expect(a).not.toContain('JBSWY3DP')
    expect(decryptSecret(a)).toBe('JBSWY3DPEHPK3PXP')
    expect(encryptSecret('JBSWY3DPEHPK3PXP')).not.toBe(a)
    expect(() => decryptSecret(a.slice(0, -2) + 'xx')).toThrow()
  })

  it('enforces a password policy', () => {
    expect(passwordProblem('short1A')).toBeTruthy()
    expect(passwordProblem('alllowercase123456')).toBeTruthy()
    expect(passwordProblem('Good-Password-2026')).toBeNull()
  })

  it('issues recovery codes whose hashes are stable', () => {
    const { codes, hashes } = generateRecoveryCodes(3)
    expect(codes).toHaveLength(3)
    expect(hashRecoveryCode(codes[0]!.toUpperCase())).toBe(hashes[0])
  })
})
