import { describe, expect, it } from 'vitest'
import { LOGO_POLICY } from './logoPolicy'
import { BRAND_INITIALS, brandInitials, brandTileColors } from './brandTile'
import { SUBSCRIPTION_CATALOG } from './subscriptionCatalog'
import { INK_DARK, INK_DARK_HEX, INK_LIGHT, INK_LIGHT_HEX, contrastRatio, parseHex } from '@/lib/ui/contrast'

describe('brand monograms', () => {
  const noLogo = SUBSCRIPTION_CATALOG.filter((b) => LOGO_POLICY[b.key] !== 'logo')

  it('every brand without a logo has a curated two-letter capital mark', () => {
    for (const b of noLogo) expect(BRAND_INITIALS[b.key], b.key).toMatch(/^[A-Z]{2}$/)
  })
  it('no two brands share a mark', () => {
    const marks = Object.values(BRAND_INITIALS)
    expect(new Set(marks).size).toBe(marks.length)
  })
  it('only brands that exist and show initials are mapped', () => {
    for (const k of Object.keys(BRAND_INITIALS)) {
      expect(SUBSCRIPTION_CATALOG.some((b) => b.key === k), k).toBe(true)
      expect(LOGO_POLICY[k], k).not.toBe('logo')
    }
  })
  it('custom services get capital letters from their words', () => {
    expect(brandInitials(null, 'my gym club')).toBe('MG')
    expect(brandInitials(null, 'netflix')).toBe('NE')
  })
  it('uses the brand colour with the ink token that reads better on it', () => {
    expect(brandTileColors('vodafone_eg')?.bg).toBe('#E60000')
    expect([INK_LIGHT, INK_DARK]).toContain(brandTileColors('vodafone_eg')?.fg)
    expect(brandTileColors('snapchat_plus')?.fg).toBe(INK_DARK)
    expect(brandTileColors(null)).toBeNull()
  })
  it('every monogram tile reaches 4:1 with the chosen ink, and the chosen ink is the better of the two (QA-110)', () => {
    for (const b of noLogo) {
      const t = brandTileColors(b.key)
      if (!t) continue
      const bg = parseHex(t.bg)!
      const light = contrastRatio(parseHex(INK_LIGHT_HEX)!, bg)
      const dark = contrastRatio(parseHex(INK_DARK_HEX)!, bg)
      const chosen = t.fg === INK_LIGHT ? light : dark
      expect(chosen, b.key).toBeGreaterThanOrEqual(Math.max(light, dark) - 1e-9)
      expect(chosen, b.key).toBeGreaterThanOrEqual(4)
    }
  })
})
