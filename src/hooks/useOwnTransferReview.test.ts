import { describe, expect, it } from 'vitest'
import { splitOwnTransferRows, type OwnTransferRow } from './useOwnTransferReview'

const row = (id: string, verdict: string, over: Partial<OwnTransferRow> = {}): OwnTransferRow => ({
  id, amount: 100, currency: 'EGP', received_at: '2026-11-01T10:00:00Z', own_transfer_verdict: verdict, ...over,
})

describe('splitOwnTransferRows', () => {
  it('returns one-leg own-account questions as their own list', () => {
    const { asks, settled, accountAsks } = splitOwnTransferRows([row('a', 'ask'), row('b', 'ask_account', { counterparty_last4: '5124' }), row('c', 'settle', { paired_log_id: 'x' })])
    expect(asks.map((r) => r.id)).toEqual(['a'])
    expect(accountAsks.map((r) => r.id)).toEqual(['b'])
    expect(settled.map((r) => r.id)).toEqual(['c'])
  })

  it('a settled one-leg row has no partner and so no Undo: it is not listed as settled', () => {
    expect(splitOwnTransferRows([row('d', 'settle', { paired_log_id: null })]).settled).toEqual([])
  })
})
