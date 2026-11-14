import { describe, expect, it } from 'vitest'
import { creditSenderFromTitle } from './creditSender'

// Synthetic titles only.
describe('creditSenderFromTitle', () => {
  it('reads the sender from a transfer title', () => {
    expect(creditSenderFromTitle({ name: 'Transfer from Sample Person' })).toBe('Sample Person')
    expect(creditSenderFromTitle({ name: 'transfer  from SAMPLE CO' })).toBe('SAMPLE CO')
  })
  it('uses a plain title as it is', () => {
    expect(creditSenderFromTitle({ name: 'Sample Bank' })).toBe('Sample Bank')
  })
  it('names nobody for a generic or empty title', () => {
    for (const name of ['Bank credit', 'Salary', '', '  ', 'Transfer from ']) expect(creditSenderFromTitle({ name })).toBeNull()
    expect(creditSenderFromTitle(undefined)).toBeNull()
  })
})
