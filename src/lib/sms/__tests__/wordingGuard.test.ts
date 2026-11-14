import { describe, expect, it } from 'vitest'
import { GUARD_WORDS, WORDING_GUARD_ENFORCED, guardWordsIn, storedGuardWords, wordingGuardDiverts } from '../wordingGuard'

describe('wording guard (S2c step 8e)', () => {
  it('is count only', () => {
    expect(WORDING_GUARD_ENFORCED).toBe(false)
  })

  it('finds the guard words in English and Arabic', () => {
    expect(guardWordsIn('Your payment of EGP 100 was declined')).toEqual(['declined'])
    expect(guardWordsIn('The charge was reversed and a refund will be issued')).toEqual(['reversed', 'refund', 'will be'])
    expect(guardWordsIn('Payment due on 12/11')).toEqual(['due'])
    expect(guardWordsIn('تم رفض العملية وسيتم عكس المبلغ')).toEqual(['رفض', 'عكس', 'سيتم'])
    expect(guardWordsIn('Purchase of EGP 20 at Shop')).toEqual([])
  })

  it('does not fire inside another word', () => {
    expect(guardWordsIn('Overdue reminder, subdued tone')).toEqual([])
  })

  it('diverts only for a guard word the sample did not carry', () => {
    expect(wordingGuardDiverts([], 'Purchase declined')).toBe(true)
    expect(wordingGuardDiverts(['declined'], 'Purchase declined')).toBe(false)
    expect(wordingGuardDiverts(['declined'], 'Purchase declined, refund will be sent')).toBe(true)
    expect(wordingGuardDiverts([], 'Purchase of EGP 20 at Shop')).toBe(false)
  })

  it('reads stored guard words defensively', () => {
    expect(storedGuardWords({ guardWords: ['due', 3, null] })).toEqual(['due'])
    expect(storedGuardWords({ guardWords: 'due' })).toEqual([])
    expect(storedGuardWords(undefined)).toEqual([])
    expect(GUARD_WORDS).toContain('سيتم')
  })
})
