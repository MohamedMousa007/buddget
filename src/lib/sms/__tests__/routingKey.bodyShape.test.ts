import { describe, it, expect } from 'vitest'
import { bodyShapeKey, effectiveSender, lookupKeys } from '../routingKey'

// The real capture that produced 32 `skipped_no_key` rows: iOS Shortcuts bridge, so no
// transport sender; no hotline in the body; and the AI named no bank either.
const WALLET_NOTIF_A = 'Adding money to account\nAmount: 400 SAR\nVia: *tion\nAt: 2026-07-05 21:04'
const WALLET_NOTIF_B = 'Adding money to account\nAmount: 1,250 SAR\nVia: *rah\nAt: 2026-07-19 08:11'

const HSBC_STATEMENT =
  'From HSBC: 20JUL26 TT Payment to 103-104***-110 USD 3,097.24+ Your available balance is USD 7,546.11'

describe('bodyShapeKey', () => {
  it('gives two instances of the same template the same key', () => {
    // Amount, masked merchant and timestamp all differ; the wording does not.
    expect(bodyShapeKey(WALLET_NOTIF_A)).toBe(bodyShapeKey(WALLET_NOTIF_B))
    expect(bodyShapeKey(WALLET_NOTIF_A)).toMatch(/^BODY-[0-9a-f]{8}$/)
  })

  it('separates templates that differ in their opening words', () => {
    const local = 'Local Purchase\nCard: *8639; Apple Pay\nAmount: 7.5 SAR'
    const online = 'Online Purchase\nMada card: **6774\nAmount: 86.25 SAR'
    expect(bodyShapeKey(local)).not.toBe(bodyShapeKey(online))
  })

  it('shares one bucket when two templates open identically — by design', () => {
    // "Your HSBC Account … was debited/credited" agrees for four words. The bucket holds both
    // regexes and the regexes tell the messages apart; a shared bucket costs one extra regex
    // test and never a wrong parse.
    const debited = 'Your HSBC Account ****0001 was debited with IPN outward transfer for EGP 3.50'
    const credited = 'Your HSBC Account ****0001 was credited with IPN inward transfer for EGP 2.00'
    expect(bodyShapeKey(debited)).toBe(bodyShapeKey(credited))
  })

  it('is stable across the digits and punctuation that vary per transaction', () => {
    const a = 'From HSBC: 20JUL26 TT Payment to 103-104***-110 USD 3,097.24+ balance'
    const b = 'From HSBC: 05AUG26 TT Payment to 103-104***-110 USD 812.00+ balance'
    expect(bodyShapeKey(a)).toBe(bodyShapeKey(b))
  })

  it('works on Arabic bodies, which carry no ASCII words to key on', () => {
    const ar1 = 'تم خصم مبلغ 250 جنيه من حسابك رقم 1234'
    const ar2 = 'تم خصم مبلغ 1,900 جنيه من حسابك رقم 1234'
    expect(bodyShapeKey(ar1)).toBe(bodyShapeKey(ar2))
  })

  it('refuses to key a message with too few words to identify anything', () => {
    expect(bodyShapeKey('400 SAR')).toBeNull()
    expect(bodyShapeKey('12345')).toBeNull()
  })
})

describe('effectiveSender', () => {
  it('now yields a key for the sender-less, hotline-less, bank-less notification', () => {
    // This is the whole `skipped_no_key` class: it used to return null and skip learning.
    expect(effectiveSender('', WALLET_NOTIF_A, null)).toBe(bodyShapeKey(WALLET_NOTIF_A))
  })

  it('keeps the hotline as the strongest key so iOS and Android converge', () => {
    const body = 'CIB: purchase of EGP 250 — call 19666 for help'
    expect(effectiveSender('SOMETHING', body, 'CIB')).toBe('HOTLINE-19666')
  })

  it('prefers a real transport sender over the body shape', () => {
    expect(effectiveSender('HSBC', HSBC_STATEMENT, null)).toBe('HSBC')
  })

  it('falls back to the bank name before the body shape', () => {
    expect(effectiveSender('', WALLET_NOTIF_A, 'Al Rajhi')).toBe('AL RAJHI')
  })
})

describe('lookupKeys', () => {
  it('offers the body shape alongside sender and hotline', () => {
    const keys = lookupKeys('HSBC', HSBC_STATEMENT)
    expect(keys).toContain('HSBC')
    expect(keys).toContain(bodyShapeKey(HSBC_STATEMENT))
  })

  it('returns the shape key alone when there is nothing else', () => {
    expect(lookupKeys('', WALLET_NOTIF_A)).toEqual([bodyShapeKey(WALLET_NOTIF_A)])
  })
})
