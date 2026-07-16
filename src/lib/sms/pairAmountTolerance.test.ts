import { describe, expect, it } from 'vitest'
import { transferFeeTolerance } from './pairing'

/**
 * Paying a credit card by Instapay debits the funding bank for the payoff PLUS a fee
 * (12,012 for a 12,000 payoff), so the two legs never matched on exact equality and the
 * user saw the same payoff twice.
 *
 * The tolerance is a property of the PAIR, not of the calling leg — either leg can arrive
 * first (SmsForwardWorker retries with backoff, so delivery order is not the bank's
 * order). The RPC applies this allowance only when one side is a cc_payoff, which is what
 * keeps own_transfer <-> own_transfer matching exactly; see 0089.
 */
describe('transferFeeTolerance', () => {
  it('covers the real reported case: 12,012 funding vs 12,000 payoff', () => {
    expect(12_012 - 12_000).toBeLessThanOrEqual(transferFeeTolerance(12_000))
    // ...and symmetrically, when the funding leg is the one asking.
    expect(12_012 - 12_000).toBeLessThanOrEqual(transferFeeTolerance(12_012))
  })

  it('has a floor, so a small payoff still tolerates a flat fee', () => {
    // 2% of 100 is 2 EGP — smaller than a real transfer fee.
    expect(transferFeeTolerance(100)).toBe(25)
  })

  it('has a ceiling, so a large payoff cannot swallow an unrelated amount', () => {
    // Without the cap, 2% of 500k would be a 10k window.
    expect(transferFeeTolerance(500_000)).toBe(250)
  })

  it('scales between the floor and the ceiling', () => {
    expect(transferFeeTolerance(5_000)).toBe(100)
  })

  it('stays far below the amount itself — it is a fee allowance, not a fuzzy match', () => {
    for (const amount of [100, 1_000, 12_000, 500_000]) {
      expect(transferFeeTolerance(amount)).toBeLessThan(amount)
    }
  })

  it('is near-symmetric across the two legs, so the arrival order cannot change the outcome', () => {
    // Whichever leg calls, the window must still cover the fee between them.
    const payoff = 12_000
    const funding = 12_012
    expect(Math.abs(funding - payoff)).toBeLessThanOrEqual(transferFeeTolerance(payoff))
    expect(Math.abs(payoff - funding)).toBeLessThanOrEqual(transferFeeTolerance(funding))
  })
})
