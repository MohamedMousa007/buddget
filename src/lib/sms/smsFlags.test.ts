import { describe, expect, it } from 'vitest'
import { openSmsFlags } from './smsFlags'

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
