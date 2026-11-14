import { describe, expect, it } from 'vitest'
import { isGenericMerchant, isServiceBill, merchantKey, resolveKnownMerchant, stripGateway } from './merchantDictionary'
import { normalizeMerchant } from './merchantNormalizer'

describe('merchantKey', () => {
  it('folds case and punctuation into one identity', () => {
    expect(merchantKey('CARREFOUR')).toBe('carrefour')
    expect(merchantKey('carrefour')).toBe('carrefour')
    expect(merchantKey(' Carre-Four ')).toBe('carrefour')
  })

  it('ignores a payment gateway prefix', () => {
    expect(stripGateway('GEIDEA*SOME SHOP')).toBe('SOME SHOP')
    expect(stripGateway('Paymob-Some Shop')).toBe('Some Shop')
    expect(stripGateway('SQ *SOME SHOP')).toBe('SOME SHOP')
    expect(merchantKey('GEIDEA*CARREFOUR')).toBe(merchantKey('Carrefour'))
  })

  it('leaves a name that only starts like a gateway word', () => {
    expect(stripGateway('Tap House')).toBe('Tap House')
    expect(stripGateway('Checkout Counter')).toBe('Checkout Counter')
    expect(stripGateway('Geidea')).toBe('Geidea')
  })
})

describe('resolveKnownMerchant', () => {
  it.each([
    ['CARREFOUR', 'Carrefour', 'Groceries'],
    ['carrefour banha', 'Carrefour', 'Groceries'],
    ['BIM6OCT TAHRIR', 'BIM', 'Groceries'],
    ['GEIDEA*GOURMET CAIRO N 07 EG', 'Gourmet', 'Groceries'],
    ['MCDONALDS THE GATE', "McDonald's", 'Food'],
    ['Burger King Maadi', 'Burger King', 'Food'],
    ['Uber Eats', 'Uber Eats', 'Food'],
    ['UBER TRIP', 'Uber', 'Transport'],
    ['MOBILY', 'Mobily', 'Utilities'],
    ['Vodafone Top Up App', 'Vodafone', 'Utilities'],
    ['WE FBB PRE', 'WE', 'Utilities'],
    ['JARIR', 'Jarir', 'Shopping'],
    ['EJAR', 'Ejar', 'Rent'],
  ])('%s is %s (%s)', (raw, name, category) => {
    expect(resolveKnownMerchant(raw)).toEqual({ name, category })
  })

  it('completes a name the bank cut off, when only one brand fits', () => {
    expect(resolveKnownMerchant('CARREFO')).toEqual({ name: 'Carrefour', category: 'Groceries' })
    expect(resolveKnownMerchant('HUNGERSTA')).toEqual({ name: 'HungerStation', category: 'Food' })
    // Too short to trust, and ambiguous prefixes pick nothing.
    expect(resolveKnownMerchant('CARR')).toBeNull()
  })

  it('names the category from a trade word without inventing a merchant', () => {
    expect(resolveKnownMerchant('Some Unknown Pharmacy')).toEqual({ name: null, category: 'Health' })
    expect(resolveKnownMerchant('AL NOOR SUPERMARKET')).toEqual({ name: null, category: 'Groceries' })
    expect(resolveKnownMerchant('SHAWARMA H')).toEqual({ name: null, category: 'Food' })
  })

  it('lets a trade word outrank a brand-like first word', () => {
    expect(resolveKnownMerchant('Orange Tree Cafe')?.category).toBe('Food')
    expect(resolveKnownMerchant('Salam Restaurant')?.category).toBe('Food')
  })

  it('does not call an operator wallet a bill', () => {
    expect(resolveKnownMerchant('Vodafone Cash')).toBeNull()
    expect(resolveKnownMerchant('stc pay')).toBeNull()
    expect(resolveKnownMerchant('STC Bank')).toBeNull()
  })

  it('knows nothing about an unknown name or a short common word', () => {
    expect(resolveKnownMerchant('Establish')).toBeNull()
    expect(resolveKnownMerchant('We Fix Phones')).toBeNull()
    expect(resolveKnownMerchant('Orangetheory')).toBeNull()
    expect(resolveKnownMerchant(null)).toBeNull()
  })
})

describe('normalizeMerchant on every tier', () => {
  it('gives case variants and gateway forms the same name', () => {
    const forms = ['KAZYON', 'kazyon', 'Kazyon', 'GEIDEA*KAZYON']
    expect(new Set(forms.map((f) => normalizeMerchant(f, 'purchase')))).toEqual(new Set(['Kazyon']))
  })

  it('title-cases a lower-case merchant and strips the gateway from an unknown one', () => {
    expect(normalizeMerchant('some corner shop', 'purchase')).toBe('Some Corner Shop')
    expect(normalizeMerchant('PAYMOB-SOME CORNER SHOP', 'online_purchase')).toBe('Some Corner Shop')
  })

  it('never renames a transfer counterparty after a brand', () => {
    expect(normalizeMerchant('Transfer to Orange', 'instant_transfer_out')).toBe('Transfer to Orange')
  })
})

describe('isServiceBill', () => {
  it('recognises a deduction of service value plus stamp tax, Arabic and English', () => {
    expect(isServiceBill('تم خصم المبلغ التالى 100 قيمة خدمة؛ 1.5 ج ضريبة دمغة')).toBe(true)
    expect(isServiceBill('Deducted 100 service value and 1.5 stamp tax')).toBe(true)
  })

  it('leaves an ordinary card fee alone', () => {
    expect(isServiceBill('Annual card fee 100 SAR')).toBe(false)
    expect(isServiceBill(null)).toBe(false)
  })
})

describe('isGenericMerchant', () => {
  it('flags a bare or cut-off company-form word, which is many merchants', () => {
    for (const name of ['ESTABLISH', 'Establ', 'Establishment', 'Company S', 'مؤسسة']) expect(isGenericMerchant(name)).toBe(true)
  })

  it('leaves a real name alone, even one containing such a word', () => {
    for (const name of ['Carrefour', 'Est', 'Some Trading Shop', 'Company Store 12', null]) expect(isGenericMerchant(name)).toBe(false)
  })
})
