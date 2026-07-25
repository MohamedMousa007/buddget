import { describe, it, expect } from 'vitest'
import { priceConsensus, type PriceSample } from './consensus'

const s = (value: number, source: string, upstream?: string): PriceSample => ({ value, source, upstream })

describe('priceConsensus', () => {
  it('unavailable when no valid samples', () => {
    expect(priceConsensus([], 0.005).confidence).toBe('unavailable')
    expect(priceConsensus([s(0, 'a'), s(-1, 'b')], 0.005).value).toBeNull()
  })

  it('single source', () => {
    const r = priceConsensus([s(100, 'a')], 0.005)
    expect(r).toMatchObject({ value: 100, confidence: 'single', upstreams: 1 })
  })

  it('exact when all identical', () => {
    expect(priceConsensus([s(100, 'a'), s(100, 'b')], 0.005).confidence).toBe('exact')
  })

  it('clusters the agreeing majority instead of medianing the outlier in', () => {
    // 130/131/132 agree within 1.5%, 100 is the outlier. Median would be 130.5.
    const r = priceConsensus(
      [s(100, 'a', 'x'), s(130, 'b', 'y'), s(131, 'c', 'z'), s(132, 'd', 'w')],
      0.015,
    )
    expect(r.confidence).toBe('high')
    expect(r.value).toBeCloseTo(131, 0)
    expect(r.sources).not.toContain('a')
  })

  it('high requires 2+ DISTINCT upstreams — correlated sources do not corroborate (F17)', () => {
    // three sources but all one upstream: no independent corroboration → low, median
    const r = priceConsensus(
      [s(200, 'a', 'lbma'), s(201, 'b', 'lbma'), s(202, 'c', 'lbma')],
      0.02,
    )
    expect(r.confidence).toBe('low')
    expect(r.value).toBe(201) // median
  })

  it('two independent upstreams that agree → high', () => {
    const r = priceConsensus([s(500, 'a', 'x'), s(501, 'b', 'y')], 0.02)
    expect(r.confidence).toBe('high')
    expect(r.upstreams).toBe(2)
    expect(r.value).toBeCloseTo(500.5, 5)
  })

  it('two upstreams that disagree beyond tolerance → low', () => {
    const r = priceConsensus([s(500, 'a', 'x'), s(600, 'b', 'y')], 0.02)
    expect(r.confidence).toBe('low')
  })
})
