import { describe, expect, it } from 'vitest'
import { lineAmountInBase } from '@/lib/budget/lineEdit'

describe('lineAmountInBase (v9 budget line: currency picked inline, written in base)', () => {
  it('keeps a base amount as typed', () => {
    expect(lineAmountInBase(450, 'EGP', 'EGP', {})).toBe(450)
  })
  it('converts another currency to base, rounded to cents', () => {
    expect(lineAmountInBase(10, 'USD', 'EGP', { USD_EGP: 48.333 })).toBe(483.33)
  })
  it('gives null with no rate, so nothing is written from a guess', () => {
    expect(lineAmountInBase(10, 'XYZ', 'EGP', {})).toBeNull()
  })
})
