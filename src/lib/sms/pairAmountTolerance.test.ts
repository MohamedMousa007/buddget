import { describe, expect, it } from 'vitest'
import { pairAmountTolerance } from './pairing'

/**
 * Paying a credit card by Instapay debits the funding bank for the payoff PLUS a fee
 * (12,012 for a 12,000 payoff), so the two legs never matched on exact equality and the
 * user saw the same payoff twice.
 */
describe('pairAmountTolerance', () => {
  it('allows the real reported case: 12,012 funding vs 12,000 payoff', () => {
    expect(12_012 - 12_000).toBeLessThanOrEqual(pairAmountTolerance('cc_payoff', 12_000))
  })

  it('is exact for own transfers — both legs report the same amount', () => {
    expect(pairAmountTolerance('own_transfer', 12_000)).toBe(0)
  })

  it('is exact for every non-payoff kind', () => {
    expect(pairAmountTolerance('purchase', 12_000)).toBe(0)
    expect(pairAmountTolerance('currency_exchange', 12_000)).toBe(0)
  })

  it('has a floor, so a small payoff still tolerates a flat fee', () => {
    // 2% of 100 is 2 EGP — smaller than a real transfer fee.
    expect(pairAmountTolerance('cc_payoff', 100)).toBe(25)
  })

  it('has a ceiling, so a large payoff cannot swallow an unrelated amount', () => {
    // Without the cap, 2% of 500k would be a 10k window.
    expect(pairAmountTolerance('cc_payoff', 500_000)).toBe(250)
  })

  it('scales between the floor and the ceiling', () => {
    expect(pairAmountTolerance('cc_payoff', 5_000)).toBe(100)
  })

  it('stays far below the payoff itself — it is a fee allowance, not a fuzzy match', () => {
    for (const amount of [100, 1_000, 12_000, 500_000]) {
      expect(pairAmountTolerance('cc_payoff', amount)).toBeLessThan(amount)
    }
  })
})
