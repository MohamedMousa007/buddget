import { describe, expect, it } from 'vitest'
import { BALANCE_EPSILON, balanceEpsilon, settleBalance } from './balanceMath'

describe('balanceMath', () => {
  it('settles float drift', () => {
    expect(settleBalance(0.1 + 0.2)).toBe(0.3)
    expect(settleBalance(1.5)).toBe(1.5)
  })
  it('keeps 8-decimal crypto amounts', () => {
    expect(settleBalance(0.12345678 + 0.00000001)).toBe(0.12345679)
    expect(settleBalance(0.00000001)).toBe(0.00000001)
  })
  it('never returns negative zero', () => {
    expect(Object.is(settleBalance(-1e-15), 0)).toBe(true)
    expect(Object.is(settleBalance(-0), 0)).toBe(true)
  })
  it('uses 1e-9 for crypto/gold and 0.001 for money', () => {
    expect(BALANCE_EPSILON).toBe(1e-9)
    expect(balanceEpsilon('BTC')).toBe(1e-9)
    expect(balanceEpsilon('XAU')).toBe(1e-9)
    expect(balanceEpsilon('EGP')).toBe(0.001)
  })
})
