import { describe, it, expect } from 'vitest'
import { unsettledAccounts } from '@/lib/alerts/detectedAccounts'
import type { DetectedAccount } from '@/hooks/usePaymentMethodDetector'

const acct = (key: string, last4 = '4417'): DetectedAccount => ({ key, last4, provider: 'HSBC', type: 'bank_account', currency: null, count: 3 })

describe('unsettledAccounts', () => {
  const found = [acct('pm:4417'), acct('pm:9921', '9921'), acct('pm:0042', '0042')]
  it('keeps everything when nothing was answered', () => {
    expect(unsettledAccounts(found, undefined, [])).toHaveLength(3)
  })
  it('drops an account the user said "Not mine" to on any device (synced promptState)', () => {
    expect(unsettledAccounts(found, { 'pm:9921': '2026-11-20T10:00:00Z' }, []).map((a) => a.key)).toEqual(['pm:4417', 'pm:0042'])
  })
  it('drops an account hidden on this phone', () => {
    expect(unsettledAccounts(found, {}, ['pm:0042']).map((a) => a.key)).toEqual(['pm:4417', 'pm:9921'])
  })
  it('drops accounts held back for the Undo window, and brings them back when released', () => {
    expect(unsettledAccounts(found, {}, [], new Set(['pm:4417'])).map((a) => a.key)).toEqual(['pm:9921', 'pm:0042'])
    expect(unsettledAccounts(found, {}, [], new Set())).toHaveLength(3)
  })
  it('the same last4 under two providers stays two accounts', () => {
    const two = [acct('pm:hsbc:4417'), acct('pm:qnb:4417')]
    expect(unsettledAccounts(two, { 'pm:hsbc:4417': 'x' }, []).map((a) => a.key)).toEqual(['pm:qnb:4417'])
  })
})
