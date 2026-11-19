import { describe, expect, it } from 'vitest'
import { en } from '../dictionaries/en'
import { ar } from '../dictionaries/ar'

// The Wealth hero shows three uppercase cells across a 375px phone (about 97px each); "BANK ACCOUNTS" was cut to "BANK ACCOU…".
describe('Wealth hero cell labels', () => {
  it.each([['en', en], ['ar', ar]] as const)('%s labels stay short enough for three cells on a phone', (_l, d) => {
    for (const k of ['bankAccounts', 'vault', 'cash', 'balances', 'marketPriced', 'youValue', 'other'] as const) {
      expect(d.wealthPage[k].length, k).toBeLessThanOrEqual(12)
    }
  })
})
