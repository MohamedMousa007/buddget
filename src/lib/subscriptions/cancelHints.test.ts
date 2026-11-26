import { describe, expect, it } from 'vitest'
import { cancelHint } from './cancelHints'
import { foreignSymbol } from '@/lib/constants/currencyMeta'

describe('cancelHint', () => {
  it('names only the site of a web address and links the full path (mockup "Cancel it on netflix.com")', () => {
    expect(cancelHint('netflix')).toEqual({ text: 'netflix.com/cancelplan', url: 'https://netflix.com/cancelplan', site: 'netflix.com' })
  })
  it('keeps a non-address hint whole, with no link', () => {
    expect(cancelHint('icloud')).toMatchObject({ url: null, site: 'Settings > Apple ID > Subscriptions' })
    expect(cancelHint(null)).toBeNull()
  })
})

describe('foreignSymbol', () => {
  it('writes a real sign before a foreign amount ("−$9.99 USD")', () => {
    expect(foreignSymbol('USD', 'EGP')).toBe('$')
    expect(foreignSymbol('EUR', 'EGP')).toBe('€')
  })
  it('writes nothing for the base currency or a letter-code symbol', () => {
    expect(foreignSymbol('EGP', 'EGP')).toBe('')
    expect(foreignSymbol('AED', 'EGP')).toBe('')
    expect(foreignSymbol('USD', 'USD')).toBe('')
  })
})
