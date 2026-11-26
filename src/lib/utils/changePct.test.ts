import { describe, expect, it } from 'vitest'
import { changePct, formatChangePct } from './changePct'

describe('changePct', () => {
  it('is the signed change against the base', () => {
    expect(changePct(150, 100)).toBe(50)
    expect(changePct(50, 100)).toBe(-50)
    expect(changePct(-50, -100)).toBe(50)
  })
  it('is null when the base is zero or near zero next to now', () => {
    expect(changePct(0, 0)).toBeNull()
    expect(changePct(500, 0)).toBeNull()
    expect(changePct(2_479_426, 100)).toBeNull()
    expect(changePct(Number.NaN, 1)).toBeNull()
  })
  it('keeps a large but meaningful change', () => {
    expect(changePct(5000, 100)).toBe(4900)
  })
})

describe('formatChangePct', () => {
  it('caps past 999%', () => {
    expect(formatChangePct(4900)).toBe('>999%')
    expect(formatChangePct(-1200)).toBe('>999%')
    expect(formatChangePct(999)).toBe('999%')
  })
  it('rounds to whole numbers, one decimal under 10 when asked', () => {
    expect(formatChangePct(-12.4)).toBe('12%')
    expect(formatChangePct(3.24, 1)).toBe('3.2%')
    expect(formatChangePct(24.6, 1)).toBe('25%')
  })
})
