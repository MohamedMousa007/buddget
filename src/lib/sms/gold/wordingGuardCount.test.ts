import { describe, expect, it } from 'vitest'
import { countWordingGuardHits } from './wordingGuardCount'

describe('countWordingGuardHits', () => {
  it('counts rows and each unexpected word', () => {
    const r = countWordingGuardHits([
      { body: 'Purchase EGP 20 at Shop', templateGuardWords: [] },
      { body: 'Purchase declined', templateGuardWords: [] },
      { body: 'Purchase declined', templateGuardWords: ['declined'] },
      { body: 'Refund reversed, will be posted', templateGuardWords: ['refund'] },
    ])
    expect(r).toEqual({ rows: 4, hits: 2, perWord: { declined: 1, reversed: 1, 'will be': 1 } })
  })
  it('an empty list is zero', () => {
    expect(countWordingGuardHits([])).toEqual({ rows: 0, hits: 0, perWord: {} })
  })
})
