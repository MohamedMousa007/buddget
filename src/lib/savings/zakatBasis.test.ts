import { describe, expect, it } from 'vitest'
import { effectiveNisabBasis, withNisabBasis, zakatBasisChosen } from './zakatBasis'

describe('zakatBasis', () => {
  it('treats no config as unchosen and legacy configs as chosen', () => {
    expect(zakatBasisChosen(null)).toBe(false)
    expect(zakatBasisChosen(undefined)).toBe(false)
    expect(zakatBasisChosen({ nisabBasis: 'silver', holdsForTrading: false })).toBe(true)
    expect(zakatBasisChosen({ nisabBasis: 'gold', nisabBasisChosen: false, holdsForTrading: false })).toBe(false)
  })
  it('falls back to gold', () => {
    expect(effectiveNisabBasis(null)).toBe('gold')
    expect(effectiveNisabBasis({ nisabBasis: 'silver', holdsForTrading: false })).toBe('silver')
  })
  it('records the choice and keeps other fields', () => {
    expect(withNisabBasis({ nisabBasis: 'gold', holdsForTrading: true, manualAmount: 5 }, 'silver')).toEqual({
      nisabBasis: 'silver', nisabBasisChosen: true, holdsForTrading: true, manualAmount: 5,
    })
    expect(withNisabBasis(null, 'gold').nisabBasisChosen).toBe(true)
  })
})

describe('zakatBasisQuestionNeeded (QA-117)', () => {
  it('asks only between the silver and gold lines, and only until answered', async () => {
    const { zakatBasisQuestionNeeded } = await import('./zakatBasis')
    expect(zakatBasisQuestionNeeded('silverOnly', null)).toBe(true)
    expect(zakatBasisQuestionNeeded('none', null)).toBe(false)
    expect(zakatBasisQuestionNeeded('both', null)).toBe(false)
    expect(zakatBasisQuestionNeeded('silverOnly', { holdsForTrading: false, nisabBasis: 'silver', nisabBasisChosen: true })).toBe(false)
  })
})
