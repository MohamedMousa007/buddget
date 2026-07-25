import { describe, it, expect } from 'vitest'
import {
  egyptGram24,
  egyptKaratPrice,
  egyptGoldPound,
  impliedSaghaFromKarat,
  saghaWithinSanity,
  localVsGlobalGapPerGram,
} from './egyptGold'

// Ground truth: eDahab screenshot, 2026-07-24. Ounce $4,063.5, Sagha 52.40, official 51.35.
const OUNCE = 4063.5
const SAGHA = 52.4
const OFFICIAL = 51.35

describe('Egypt gold — reproduces the live eDahab screenshot', () => {
  it('24k gram ≈ 6,846 EGP', () => {
    expect(egyptGram24(OUNCE, SAGHA)).toBeCloseTo(6846, 0)
  })
  it('21k ≈ 5,990 EGP', () => {
    expect(egyptKaratPrice(OUNCE, SAGHA, 21)).toBeCloseTo(5990, 0)
  })
  it('18k ≈ 5,135 EGP', () => {
    expect(egyptKaratPrice(OUNCE, SAGHA, 18)).toBeCloseTo(5134, 0)
  })
  it('gold pound ≈ 47,920 EGP', () => {
    expect(egyptGoldPound(OUNCE, SAGHA)).toBeCloseTo(47920, 0)
  })
  it('local-vs-global gap ≈ 137 EGP/g', () => {
    expect(localVsGlobalGapPerGram(OUNCE, SAGHA, OFFICIAL)).toBeCloseTo(137, 0)
  })
})

describe('impliedSaghaFromKarat — back-calc round-trips', () => {
  it('recovers the Sagha dollar from any karat price', () => {
    const p21 = egyptKaratPrice(OUNCE, SAGHA, 21)
    expect(impliedSaghaFromKarat(p21, 21, OUNCE)).toBeCloseTo(SAGHA, 4)
    const p18 = egyptKaratPrice(OUNCE, SAGHA, 18)
    expect(impliedSaghaFromKarat(p18, 18, OUNCE)).toBeCloseTo(SAGHA, 4)
  })
})

describe('saghaWithinSanity', () => {
  it('accepts the observed 52.40 vs 51.35', () => {
    expect(saghaWithinSanity(SAGHA, OFFICIAL)).toBe(true)
  })
  it('rejects a spot-derived (official-rate) value far below the market', () => {
    expect(saghaWithinSanity(OFFICIAL * 0.9, OFFICIAL)).toBe(false)
  })
  it('rejects a garbage scrape', () => {
    expect(saghaWithinSanity(500, OFFICIAL)).toBe(false)
    expect(saghaWithinSanity(0, OFFICIAL)).toBe(false)
  })
})
