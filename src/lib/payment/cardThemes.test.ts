import { describe, expect, it } from 'vitest'
import { INK_DARK_HEX, INK_LIGHT_HEX, contrastRatio, parseHex } from '@/lib/ui/contrast'
import { CARD_COLORS, PAYMENT_BRANDS } from './paymentMethodDefaults'
import { CARD_THEMES, CARD_THEME_KEYS, bankAbbreviation, cardLook, isCardThemeKey, nearestCardTheme } from './cardThemes'

describe('card themes', () => {
  it('there are exactly the 16 approved themes', () => {
    expect(CARD_THEME_KEYS).toHaveLength(16)
    expect(Object.keys(CARD_THEMES).sort()).toEqual([...CARD_THEME_KEYS].sort())
  })

  it.each(CARD_THEME_KEYS)('%s ink reaches 4.5:1 on both gradient stops', (k) => {
    const t = CARD_THEMES[k]
    const ink = parseHex(t.ink === 'light' ? INK_LIGHT_HEX : INK_DARK_HEX)!
    expect(contrastRatio(ink, parseHex(t.a)!)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ink, parseHex(t.b)!)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('old free-colour cards map to a theme', () => {
  it('each theme midpoint maps back to its own theme', () => {
    for (const k of CARD_THEME_KEYS) {
      const a = parseHex(CARD_THEMES[k].a)!
      const b = parseHex(CARD_THEMES[k].b)!
      const mid = '#' + [0, 1, 2].map((i) => Math.round((a[i] + b[i]) / 2).toString(16).padStart(2, '0')).join('')
      expect(nearestCardTheme(mid)).toBe(k)
    }
  })

  it('every colour of the old picker lands on a real theme, never blank', () => {
    for (const c of CARD_COLORS) expect(isCardThemeKey(cardLook({ type: 'debit_card', color: c }).theme)).toBe(true)
  })

  it('a card with no theme, no colour or a broken one still gets a look, style bank', () => {
    expect(cardLook({ type: 'credit_card' })).toEqual({ style: 'bank', theme: nearestCardTheme('#3B82F6') })
    expect(cardLook({ type: 'credit_card', color: 'not-a-colour' })).toEqual({ style: 'bank', theme: 'navy' })
    expect(cardLook({ type: 'credit_card', color: '#000000', cardTheme: 'gone' }).theme).toBe('blackMetal')
  })

  it('a saved style and theme win over the colour', () => {
    expect(cardLook({ type: 'debit_card', color: '#ffffff', cardStyle: 'metal', cardTheme: 'copper' })).toEqual({ style: 'metal', theme: 'copper' })
  })
})

describe('bankAbbreviation', () => {
  it.each([
    ['CIB', 'CIB'],
    ['NBE', 'NBE'],
    ['National Bank of Egypt', 'NBE'],
    ['QNB Alahli', 'QNB'],
    ['QNB', 'QNB'],
    ['Banque Misr', 'BM'],
    ['بنك مصر', 'BM'],
    ['Emirates NBD', 'ENBD'],
    ['HSBC Egypt', 'HSBC'],
    ['Vodafone Cash', 'VC'],
    ['Bank of Alexandria', 'BA'],
    ['Nile Crest Bank', 'NCB'],
    ['Zand', 'ZAND'],
    ['Telda', 'TEL'],
  ])('%s -> %s', (name, abbr) => {
    expect(bankAbbreviation(name)).toBe(abbr)
  })

  it('initials of an unknown long name stop at 4', () => {
    expect(bankAbbreviation('First Grand Union Savings Bank Of Cairo')).toBe('FGUS')
  })

  it('every catalogue name abbreviates to 1-4 characters', () => {
    for (const b of Object.values(PAYMENT_BRANDS)) {
      const a = bankAbbreviation(b.name)
      expect(a.length, b.name).toBeGreaterThan(0)
      expect(a.length, b.name).toBeLessThanOrEqual(4)
    }
  })

  it('an unknown Arabic name keeps its first word', () => {
    expect(bankAbbreviation('مصرف النيل')).toBe('مصرف')
  })
})
