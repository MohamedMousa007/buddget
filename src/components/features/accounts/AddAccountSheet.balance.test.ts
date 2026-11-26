import { describe, expect, it } from 'vitest'
import { typedOpeningBalance } from './AddAccountSheet'

describe('Add account balance (live QA: a new, empty wallet could not be added)', () => {
  it('an empty field is the 0 its placeholder shows', () => {
    expect(typedOpeningBalance('')).toBe(0)
    expect(typedOpeningBalance('  ')).toBe(0)
  })
  it('a typed 0 or amount is kept', () => {
    expect(typedOpeningBalance('0')).toBe(0)
    expect(typedOpeningBalance('1250.5')).toBe(1250.5)
  })
  it('text that is not a number blocks saving', () => {
    expect(typedOpeningBalance('.')).toBeNull()
  })
})
