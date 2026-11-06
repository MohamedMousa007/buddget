import { describe, expect, it } from 'vitest'
import { CARD_COLORS } from '@/lib/payment/paymentMethodDefaults'
import { INK_DARK, INK_DARK_HEX, INK_LIGHT, INK_LIGHT_HEX, cardFace, contrastRatio, inkFor, parseHex, readableInkKind } from './contrast'
import { inkOn } from '@/components/features/accounts/accountDisplay'

const rgb = (h: string) => parseHex(h)!
const scale = (h: string, f: number) => rgb(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as [number, number, number]

describe('contrast maths', () => {
  it('black on white is 21:1 and the ratio is symmetric', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
  })

  it('parses #RRGGBB and rejects anything else', () => {
    expect(parseHex('#0D8578')).toEqual([13, 133, 120])
    expect(parseHex('0D8578')).toEqual([13, 133, 120])
    expect(parseHex('var(--x)')).toBeNull()
  })
})

describe('inkFor / inkOn pick the readable ink', () => {
  it('dark ink on light fills, light ink on dark fills', () => {
    expect(inkFor('#E8A200')).toBe(INK_DARK)
    expect(inkFor('#84BD00')).toBe(INK_DARK)
    expect(inkFor('#22232E')).toBe(INK_LIGHT)
    expect(inkOn('#2E5AAC')).toBe(INK_LIGHT)
  })

  it('never returns the theme text colour, which is near-white in dark mode', () => {
    for (const c of CARD_COLORS) expect(inkOn(c)).not.toContain('text-primary')
  })

  it('falls back for non-hex input', () => {
    expect(inkOn('rebeccapurple')).toBe('var(--color-brand-on-primary)')
  })
})

describe('payment card face (A11-2)', () => {
  it('the ink reaches 4.5:1 at the light, middle and dark gradient stops of all 25 swatches', () => {
    for (const c of CARD_COLORS) {
      const { inkKind, stops } = cardFace(c)
      const ink = rgb(inkKind === 'light' ? INK_LIGHT_HEX : INK_DARK_HEX)
      for (const f of stops) expect(contrastRatio(ink, scale(c, f)), `${c} at ${f}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('white text on the old fixed-white face failed for 15 of 25 swatches (regression guard on the premise)', () => {
    const failing = CARD_COLORS.filter((c) => contrastRatio(rgb(INK_LIGHT_HEX), rgb(c)) < 4.5)
    expect(failing.length).toBe(15)
  })

  it('keeps the original sheen where the ink already clears the bar', () => {
    expect(cardFace('#22232E').stops).toEqual([1.18, 1, 0.6])
    expect(cardFace('#4F008C').stops).toEqual([1.18, 1, 0.6])
  })

  it('only nudges the mid colour when neither ink reaches 4.5:1 on it', () => {
    const c = '#0E86C0'
    expect(Math.max(contrastRatio(rgb(INK_LIGHT_HEX), rgb(c)), contrastRatio(rgb(INK_DARK_HEX), rgb(c)))).toBeLessThan(4.5)
    const { stops } = cardFace(c)
    expect(stops[1]).not.toBe(1)
    expect(Math.abs(stops[1] - 1)).toBeLessThan(0.1)
  })

  it('light fills pick the dark ink', () => {
    for (const c of ['#E8A200', '#F59E0B', '#84BD00', '#C6A24E', '#0EA5E9']) expect(readableInkKind(c)).toBe('dark')
  })
})
