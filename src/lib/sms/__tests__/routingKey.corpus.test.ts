import { describe, it, expect } from 'vitest'
import { bodyShapeKey } from '../routingKey'

/**
 * Real sender-less families from sms_parse_log (July 2026) — every one of these reached the
 * AI tier and produced no template, because hotline, sender and bank_name were all null.
 * Each entry is two captures of the SAME bank template with different transaction values.
 * The key must agree within a family and differ between families.
 */
const FAMILIES: Record<string, [string, string]> = {
  walletTopUp: [
    'Adding money to account\nAmount: 400 SAR\nVia: *tion\nAt: 2026-07-05 21:04',
    'Adding money to account\nAmount: 1,250 SAR\nVia: *rah\nAt: 2026-07-19 08:11',
  ],
  localPurchaseApplePay: [
    'Local Purchase\nCard: *8639; Apple Pay \nAmount: 7.5 SAR\nAt: EBDAA \nDate: 23/07/26 23:18',
    'Local Purchase\nCard: *8639; Apple Pay \nAmount: 46 SAR\nAt: BAHR A\nDate: 21/07/26 21:44',
  ],
  localPurchaseMada: [
    'Local Purchase\nCard: *1313; Mada \nAmount: 50 SAR\nAt: Fastel\nDate: 06/07/26 17:34',
    'Local Purchase\nCard: *1313; Mada \nAmount: 215 SAR\nAt: ALOTAI\nDate: 06/07/26 17:19',
  ],
  posPurchase: [
    'POS Purchase\nMada card: **6774\namount:2.00 SAR\nBalance: 23.11\natESTABLISHMENT\n2026-07-06 17:49',
    'POS Purchase\nMada card: **6774\namount:3.24 SAR\nBalance: 9.11\natKONOZ\n2026-07-05 21:24',
  ],
  // The sender's initial ("From:A" / "From:M") is welded to its label — the case that forced
  // splitting on punctuation rather than whitespace.
  internalIncoming: [
    'Internal incoming transfer\nAmount:1000SR\nFrom:A ALABOUDI\nAcc:237\nAt:23/07/26 05:52',
    'Internal incoming transfer\nAmount:400SR\nFrom:M FARAG\nAcc:677\nAt:21/07/26 20:46',
  ],
  // Arabic Saudi POS: the card number is welded into "عبر:9379;مدى-ابل".
  posArabic: [
    'شراء PoS\nعبر:9379;مدى-ابل باي\nبـSAR 70\nلـALRMAL CO\n؜22/7/26 04:27',
    'شراء PoS\nعبر:9379;مدى-ابل باي\nبـSAR 5\nلـMARAAFI A\n؜22/7/26 04:21',
  ],
  rejected: [
    'Rejected transaction: Insufficient balance\nCard: **6774\nAmount: 5.74 USD (21.56 SAR)\nAt: KICK STREAMING\nOn: 2026-07-19 19:34',
    'Rejected transaction: Insufficient balance\nCard: **6774\nAmount: 23 USD (86.39 SAR)\nAt: ANTHROPIC CLAUDE SUB\nOn: 2026-07-17 18:17',
  ],
  barqTopUp: [
    'Money Added to your Barq wallet\namount: 2.0 SAR\nvia: Apple pay\ncard number: **8639\n2026-07-16 23:34',
    'Money Added to your Barq wallet\namount: 64.14 SAR\nvia: Apple pay\ncard number: **9379\n2026-06-30 01:23',
  ],
  arabicDebitCard: [
    'تم خصم EGP 12.75  من بطاقة الخصم المباشر # **6212 باستخدام Apple Pay عند  KAZYON في  07/07/26 17:16الرصيد المتاح  EGP3957.91.',
    'تم خصم EGP 299.52  من بطاقة الخصم المباشر # **6212 باستخدام Apple Pay عند  SAHL في  02/07/26 22:08الرصيد المتاح  EGP4018.66.',
  ],
}

describe('bodyShapeKey over the real sender-less corpus', () => {
  it.each(Object.entries(FAMILIES))('%s: both captures share one key', (_name, [a, b]) => {
    const ka = bodyShapeKey(a)
    expect(ka).not.toBeNull()
    expect(ka).toBe(bodyShapeKey(b))
  })

  it('gives every family its own bucket', () => {
    const keys = Object.entries(FAMILIES).map(([name, [a]]) => [name, bodyShapeKey(a)] as const)
    const seen = new Map<string, string>()
    for (const [name, key] of keys) {
      const clash = seen.get(key!)
      expect(clash, `${name} collides with ${clash}`).toBeUndefined()
      seen.set(key!, name)
    }
    expect(seen.size).toBe(Object.keys(FAMILIES).length)
  })

  it('separates the debit and credit halves of one bank template', () => {
    // These carry a real sender so the shape key is never reached in production, but the
    // skeleton must still be able to tell them apart if it ever is.
    const out = 'يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 230.00 جم من حسابك المنتهي بـ ********3704'
    const inn = 'يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 230.00 جم إلى حسابك المنتهي بـ ********3704'
    // First four words are identical ("يرجى العلم انه تم"), so they SHARE a bucket — which is
    // correct and harmless: the two regexes in that bucket tell the messages apart.
    expect(bodyShapeKey(out)).toBe(bodyShapeKey(inn))
  })
})
