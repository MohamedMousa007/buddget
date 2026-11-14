import { describe, expect, it } from 'vitest'
import { maskPii, scanForLeaks } from '../maskPii'
import { perUserLiteralKinds } from '../literalLeaks'

describe('name slot rule (S2c step 9d)', () => {
  it('masks a Latin name after "to" in a transfer message, in any case and as a single word', () => {
    expect(maskPii('Transfer to Hassan completed for EGP 50.00')).toBe('Transfer to <NAME> completed for EGP 50.00')
    expect(maskPii('instant transfer to omar farouk sent, EGP 50.00')).toContain('to <NAME>')
    expect(maskPii('instant transfer to omar farouk sent, EGP 50.00')).not.toMatch(/omar|farouk/i)
  })

  it('masks a partly starred name and a name after "from"', () => {
    const out = maskPii('IPN transfer received from Kar*m Sa**d on 12/11 ref 98765432')
    expect(out).not.toContain('Kar*m')
    expect(out).not.toContain('Sa**d')
    expect(out).toContain('from <NAME>')
  })

  it('masks the words after "beneficiary"', () => {
    expect(maskPii('Transfer sent. Beneficiary: Laila Mansour, EGP 20.00')).not.toContain('Mansour')
  })

  it('stops at a currency, a digit run, a keyword and at four words', () => {
    expect(maskPii('Transfer to Nadia Aziz EGP 500.00')).toBe('Transfer to <NAME> EGP 500.00')
    expect(maskPii('Transfer to Nadia ref 12')).toBe('Transfer to <NAME> ref 12')
    const four = maskPii('Transfer to uno dos tres cuatro cinco sent')
    expect(four).toBe('Transfer to <NAME> cinco sent')
  })

  it('masks an Arabic name after the cue and keeps the cue', () => {
    const out = maskPii('تم تحويل 500 جنيه إلى ليلى منصور بتاريخ 12/11')
    expect(out).toContain('إلى <NAME>')
    expect(out).not.toContain('منصور')
    expect(out).toContain('بتاريخ')
    expect(maskPii('حوالة للمستفيد سلمى حسن')).toContain('للمستفيد <NAME>')
  })

  it('leaves a merchant after "at", an amount after "to", an own account and a bank', () => {
    expect(maskPii('Transfer fee charged at Cairo mart')).toContain('at Cairo mart')
    expect(maskPii('Transfer limit raised to EGP 5,000 today')).toContain('to EGP')
    expect(maskPii('Transfer from your account to HSBC Egypt done')).toContain('to HSBC Egypt')
    expect(maskPii('تحويل من حسابك إلى بطاقتك')).toBe('تحويل من حسابك إلى بطاقتك')
  })

  it('does nothing in a message with no transfer keyword', () => {
    expect(maskPii('Purchase from corner shop for EGP 20.00')).toBe('Purchase from corner shop for EGP 20.00')
  })

  it('is idempotent', () => {
    const once = maskPii('Transfer to Hassan completed')
    expect(maskPii(once)).toBe(once)
  })

  it('the leak scan finds an unmasked slot and nothing in masked text', () => {
    expect(scanForLeaks('Transfer to Hassan done').map((f) => f.kind)).toContain('name_slot')
    expect(scanForLeaks(maskPii('Transfer to Hassan done')).map((f) => f.kind)).not.toContain('name_slot')
  })

  it('a learned regex literal with transfer wording is not a per-user literal', () => {
    expect(perUserLiteralKinds('Transfer to your account (\\d+) EGP ([\\d,.]+)')).toEqual([])
  })
})
