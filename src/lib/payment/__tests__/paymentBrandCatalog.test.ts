import { describe, it, expect } from 'vitest'
import {
  PAYMENT_BRANDS,
  QUICK_ADD,
  resolvePaymentBrandKey,
  composePaymentMethodName,
  PAYMENT_TYPE_META,
  SETUP_TYPES,
  typesForBrand,
  brandIssuesType,
} from '@/lib/payment/paymentMethodDefaults'

describe('resolvePaymentBrandKey', () => {
  it('matches canonical names', () => {
    expect(resolvePaymentBrandKey('Vodafone Cash')).toBe('vodafone')
    expect(resolvePaymentBrandKey('STC Pay')).toBe('stcpay')
    expect(resolvePaymentBrandKey('Emirates NBD')).toBe('enbd')
    expect(resolvePaymentBrandKey('Tabby')).toBe('tabby')
    expect(resolvePaymentBrandKey('KNET')).toBe('knet')
  })

  it('matches aliases and bank SMS-sender variants', () => {
    expect(resolvePaymentBrandKey('National Bank of Egypt')).toBe('nbe')
    expect(resolvePaymentBrandKey('AL AHLY')).toBe('nbe')
    expect(resolvePaymentBrandKey('Commercial International Bank')).toBe('cib')
    expect(resolvePaymentBrandKey('Al Rajhi Bank')).toBe('alrajhi')
  })

  it('resolves short sender IDs that are a word of the brand name', () => {
    expect(resolvePaymentBrandKey('NBD')).toBe('enbd')
    expect(resolvePaymentBrandKey('MISR')).toBe('banquemisr')
    expect(resolvePaymentBrandKey('WE')).toBe('wepay')
  })

  it('rejects generic words shared by several brands', () => {
    for (const generic of ['Cash', 'Bank', 'Card', 'Money', 'Pay']) {
      expect(resolvePaymentBrandKey(generic)).toBeNull()
    }
  })

  it('needs a word boundary for a short token, not bare containment', () => {
    expect(resolvePaymentBrandKey('Dinner at Nolans')).toBeNull()
    expect(resolvePaymentBrandKey('NOL card top-up')).toBe('nol')
  })

  it('prefers the most specific brand when names nest', () => {
    expect(resolvePaymentBrandKey('HSBC Egypt purchase alert')).toBe('hsbceg')
    expect(resolvePaymentBrandKey('Meeza debit card')).toBe('meezadebit')
  })

  // Every distinct sender / bank_name in sms_parse_log, with the id each one
  // resolved to before the generic-word hardening. Pins the live corpus so a
  // future matcher change has to answer for any sender it moves.
  it.each([
    ['CIB', 'cib'],
    ['HSBC', 'hsbceg'],
    ['HSBC Egypt', 'hsbceg'],
    ['NBE', 'nbe'],
    ['QNB EGYPT', 'qnbeg'],
    ['Barq', 'barq'],
    ['Vodafone', 'vodafone'],
    ['Vodafone Cash', 'vodafone'],
    ['we', 'wepay'],
    ['WE Pay', 'wepay'],
    // Telecom/misc senders that are not payment providers.
    ['NTRA', null],
    ['STENG', null],
    ['Tawsilla', null],
    ['we-Landline', null],
    ['WE Feedback', null],
    ['VF-Cash', 'vodafone'],
  ])('live sender %s resolves to %s', (sender, expected) => {
    expect(resolvePaymentBrandKey(sender)).toBe(expected)
  })

  it('returns null for unknown or empty input', () => {
    expect(resolvePaymentBrandKey('Some Random Merchant XYZ')).toBeNull()
    expect(resolvePaymentBrandKey('')).toBeNull()
    expect(resolvePaymentBrandKey(null)).toBeNull()
    expect(resolvePaymentBrandKey(undefined)).toBeNull()
  })
})

describe('catalogue integrity', () => {
  it('every brand resolves to a valid type and has colours', () => {
    for (const b of Object.values(PAYMENT_BRANDS)) {
      expect(PAYMENT_TYPE_META[b.type]).toBeDefined()
      expect(b.colors).toHaveLength(2)
      expect(b.short.length).toBeGreaterThan(0)
    }
  })

  it('quick-add ids all exist in the catalogue', () => {
    for (const ids of Object.values(QUICK_ADD)) {
      for (const id of ids) expect(PAYMENT_BRANDS[id]).toBeDefined()
    }
  })
})

describe('composePaymentMethodName', () => {
  it('composes name with last4, tag, or neither', () => {
    expect(composePaymentMethodName('HSBC', { last4: '0001' })).toBe('HSBC ••0001')
    expect(composePaymentMethodName('Cash', { tag: 'Personal' })).toBe('Cash · Personal')
    expect(composePaymentMethodName('Vodafone Cash')).toBe('Vodafone Cash')
  })
})

describe('typesForBrand / brandIssuesType', () => {
  it('lets a bank issue credit cards, so a locked credit-card context keeps the bank', () => {
    // The bug: picking CIB (primary type bank_account) in Add-credit-card silently
    // saved a bank account. A bank must be a valid credit-card issuer.
    expect(brandIssuesType(PAYMENT_BRANDS.cib, 'credit_card')).toBe(true)
    expect(brandIssuesType(PAYMENT_BRANDS.cib, 'debit_card')).toBe(true)
    expect(typesForBrand(PAYMENT_BRANDS.cib)).toContain('bank_account')
  })

  it('never offers a credit card for a national debit scheme', () => {
    // mada/Meeza/KNET issue debit + prepaid only; a "mada credit card" cannot exist.
    for (const id of ['mada', 'knet', 'benefit', 'jaywan']) {
      expect(brandIssuesType(PAYMENT_BRANDS[id], 'credit_card')).toBe(false)
    }
  })

  it('allows the cards that card-issuing BNPL providers really ship', () => {
    // Tabby Card (Visa), Tamara/valU/Postpay/Spotii prepaid cards.
    for (const id of ['tabby', 'tamara', 'valu', 'postpay', 'spotii']) {
      expect(brandIssuesType(PAYMENT_BRANDS[id], 'prepaid_card')).toBe(true)
    }
    // ...but none of them issues a credit card.
    expect(brandIssuesType(PAYMENT_BRANDS.tabby, 'credit_card')).toBe(false)
    // A BNPL with no own-brand card stays BNPL-only.
    expect(typesForBrand(PAYMENT_BRANDS.sympl)).toEqual(['bnpl'])
  })

  it('treats STC Pay as the licensed bank it became', () => {
    expect(brandIssuesType(PAYMENT_BRANDS.stcpay, 'bank_account')).toBe(true)
  })

  it('keeps closed-loop and e-money cards out of the wrong grids', () => {
    // Transit/fuel/meal cards are stored value, not wallets or bank products.
    expect(typesForBrand(PAYMENT_BRANDS.nol)).toEqual(['prepaid_card'])
    // Wallets issue prepaid cards, never debit (no IBAN behind them).
    expect(brandIssuesType(PAYMENT_BRANDS.telda, 'debit_card')).toBe(false)
    expect(brandIssuesType(PAYMENT_BRANDS.telda, 'prepaid_card')).toBe(true)
  })

  it('excludes tokenisation rails from every card context', () => {
    // You add the underlying card, never "an Apple Pay credit card".
    for (const id of ['applepay', 'googlepay', 'samsungpay']) {
      expect(brandIssuesType(PAYMENT_BRANDS[id], 'credit_card')).toBe(false)
      expect(brandIssuesType(PAYMENT_BRANDS[id], 'wallet')).toBe(true)
    }
  })

  it('falls back to every setup type for a custom (unmatched) provider', () => {
    expect(typesForBrand(null)).toEqual(SETUP_TYPES)
  })
})
