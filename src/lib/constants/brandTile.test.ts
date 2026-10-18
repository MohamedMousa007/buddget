import { describe, expect, it } from 'vitest'
import { LOGO_POLICY } from './logoPolicy'
import { BRAND_INITIALS, brandInitials, brandTileColors } from './brandTile'
import { SUBSCRIPTION_CATALOG } from './subscriptionCatalog'

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
  it('uses the brand colour, with dark text on light fills', () => {
    expect(brandTileColors('vodafone_eg')).toEqual({ bg: '#E60000', fg: 'white' })
    expect(brandTileColors('snapchat_plus')?.fg).toBe('black')
    expect(brandTileColors(null)).toBeNull()
  })
})
