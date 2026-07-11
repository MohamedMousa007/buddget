import { describe, it, expect } from 'vitest'
import {
  PAYMENT_BRANDS,
  QUICK_ADD,
  resolvePaymentBrandKey,
  composePaymentMethodName,
  PAYMENT_TYPE_META,
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
