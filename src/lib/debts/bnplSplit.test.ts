import { describe, expect, it } from 'vitest'
import { bnplSplitIssue } from './bnplSplit'

describe('bnplSplitIssue', () => {
  const ok = { fundingMethodId: 'pm1', firstDue: '2026-11-28', purchaseDate: '2026-10-28' }
  it('accepts a funded plan with a first due on or after the purchase', () => {
    expect(bnplSplitIssue(ok)).toBeNull()
    expect(bnplSplitIssue({ ...ok, firstDue: '2026-10-28' })).toBeNull()
  })
  it('flags a missing funding account instead of silently skipping the split', () => {
    expect(bnplSplitIssue({ ...ok, fundingMethodId: '' })).toBe('funding')
  })
  it('flags an empty, malformed or earlier first due date', () => {
    expect(bnplSplitIssue({ ...ok, firstDue: '' })).toBe('firstDue')
    expect(bnplSplitIssue({ ...ok, firstDue: '2026-13-40' })).toBe('firstDue')
    expect(bnplSplitIssue({ ...ok, firstDue: '2026-09-01' })).toBe('firstDue')
  })
})
