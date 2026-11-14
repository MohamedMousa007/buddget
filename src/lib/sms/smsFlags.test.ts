import { describe, expect, it } from 'vitest'
import { openSmsFlags, repairedPrevCategory } from './smsFlags'

describe('openSmsFlags', () => {
  it('returns stamped flags that are not acknowledged', () => {
    expect(openSmsFlags({ smsFlags: ['date_unsure', 'possible_duplicate'], smsFlagsAck: ['date_unsure'] })).toEqual(['possible_duplicate'])
  })
  it('is empty with no flags or all acknowledged', () => {
    expect(openSmsFlags({})).toEqual([])
    expect(openSmsFlags({ smsFlags: ['cash_deposit'], smsFlagsAck: ['cash_deposit'] })).toEqual([])
  })
  it('ignores flag names it does not know', () => {
    expect(openSmsFlags({ smsFlags: ['from_a_newer_server', 'refund_unmatched'] })).toEqual(['refund_unmatched'])
  })
})

describe('topup_repaired data entries', () => {
  it('topup_prev entries are data, not flags: selection ignores them', () => {
    expect(openSmsFlags({ smsFlags: ['topup_repaired', 'topup_prev:Utilities'] })).toEqual(['topup_repaired'])
    expect(openSmsFlags({ smsFlags: ['topup_prev:Utilities'] })).toEqual([])
  })
  it('repairedPrevCategory reads the previous category or null', () => {
    expect(repairedPrevCategory(['topup_repaired', 'topup_prev:Utilities'])).toBe('Utilities')
    expect(repairedPrevCategory(['topup_repaired'])).toBeNull()
    expect(repairedPrevCategory(['topup_prev:'])).toBeNull()
    expect(repairedPrevCategory(null)).toBeNull()
  })
})
