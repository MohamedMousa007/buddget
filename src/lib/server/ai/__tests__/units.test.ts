import { describe, expect, it } from 'vitest'
import { computeUnits, estimateUnits, usageFromGemini } from '@/lib/server/ai/units'

describe('computeUnits', () => {
  it('weights fresh input 1, cached 0.1, output 4', () => {
    expect(computeUnits({ promptTokens: 1000, cachedTokens: 800, outputTokens: 100 })).toBe(200 + 80 + 400)
  })

  it('never lets cached exceed prompt', () => {
    expect(computeUnits({ promptTokens: 100, cachedTokens: 500, outputTokens: 0 })).toBe(10)
  })
})

describe('usageFromGemini', () => {
  it('counts thinking tokens as output', () => {
    expect(
      usageFromGemini({ promptTokenCount: 50, cachedContentTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30 }),
    ).toEqual({ promptTokens: 50, cachedTokens: 10, outputTokens: 50 })
  })

  it('tolerates missing metadata', () => {
    expect(usageFromGemini(undefined)).toEqual({ promptTokens: 0, cachedTokens: 0, outputTokens: 0 })
  })
})

describe('estimateUnits', () => {
  it('reserves input at 4 chars per token plus the weighted output cap', () => {
    expect(estimateUnits(4000, 300)).toBe(1000 + 1200)
  })
})
