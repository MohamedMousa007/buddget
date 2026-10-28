import { describe, expect, it } from 'vitest'
import { accountIdentifier } from './accountDisplay'

describe('accountIdentifier', () => {
  it('shows the label in place of the digits, and the digits when there is no label', () => {
    expect(accountIdentifier({ label: 'Salary', last4: '2016' })).toBe('Salary')
    expect(accountIdentifier({ last4: '2016' })).toBe('•• 2016')
    expect(accountIdentifier({ label: '  ', last4: '2016' })).toBe('•• 2016')
  })
  it('shows nothing when the account has neither', () => {
    expect(accountIdentifier({})).toBeNull()
  })
})
