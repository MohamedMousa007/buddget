import { describe, expect, it } from 'vitest'
import { AMOUNT_MAX, amountInRange } from './useExpenseFilterStore'

describe('amountInRange', () => {
  it('treats the top stop as unbounded', () => {
    expect(amountInRange(98_700_000, 0, AMOUNT_MAX)).toBe(true)
    expect(amountInRange(20_000, 500, AMOUNT_MAX)).toBe(true)
  })
  it('still bounds below the top stop', () => {
    expect(amountInRange(600, 0, 500)).toBe(false)
    expect(amountInRange(400, 500, AMOUNT_MAX)).toBe(false)
    expect(amountInRange(500, 500, 500)).toBe(true)
  })
})
