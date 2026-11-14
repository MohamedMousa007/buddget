import { describe, expect, it } from 'vitest'
import { matchOwnAccount, oneLegTails, readOwnAccount, type OwnAccountRow } from './ownAccounts'
import type { ServiceClient } from '@/lib/supabase/service'

/** N5: the own-account digit test uses the same alias- and length-aware match as the account resolver. */

const acct = (over: Partial<OwnAccountRow> & { id: string }): OwnAccountRow => ({ name: 'HSBC Egypt', last4: '0001', last4_aliases: [], provisional: false, closed_at: null, ...over })

describe('N5: own-account digits', () => {
  it('an account saved as 0001 answers to a tail printed as 001 when the message bank is its bank', () => {
    const r = matchOwnAccount([acct({ id: 'a', last4: '0001' })], '001', 'hsbceg')
    expect(r).toEqual({ account: true, registered: true, registeredId: 'a' })
  })

  it('a shorter printed tail with no known bank is not taken (two banks can print the same short tail)', () => {
    expect(matchOwnAccount([acct({ id: 'a', last4: '0001' })], '001', null).account).toBe(false)
  })

  it('digits that live only in last4_aliases (a merged provisional account) still answer', () => {
    const merged = acct({ id: 'a', last4: '7777', last4_aliases: ['5124'], name: 'QNB' })
    expect(matchOwnAccount([merged], '5124')).toEqual({ account: true, registered: true, registeredId: 'a' })
  })

  it('a closed account does not count', () => {
    const closed = acct({ id: 'a', last4: '5124', closed_at: '2026-09-01T00:00:00Z' })
    expect(matchOwnAccount([closed], '5124')).toEqual({ account: false, registered: false, registeredId: null })
  })

  it('two accounts answering is not registered, but is still the weaker signal', () => {
    const two = [acct({ id: 'a', last4: '5124', name: 'QNB' }), acct({ id: 'b', last4: '5124', name: 'CIB' })]
    expect(matchOwnAccount(two, '5124')).toEqual({ account: true, registered: false, registeredId: null })
  })

  it('a provisional account is the weaker signal only', () => {
    expect(matchOwnAccount([acct({ id: 'p', last4: '5124', provisional: true })], '5124')).toEqual({ account: true, registered: false, registeredId: null })
  })

  it('a confirmed account is registered even when a provisional one answers to the same digits', () => {
    const both = [acct({ id: 'a', last4: '5124' }), acct({ id: 'p', last4: '5124', provisional: true })]
    expect(matchOwnAccount(both, '5124')).toMatchObject({ account: true, registered: true, registeredId: 'a' })
  })

  it('no digits, or digits no account answers to, is no signal (I7)', () => {
    expect(matchOwnAccount([acct({ id: 'a' })], null).account).toBe(false)
    expect(matchOwnAccount([acct({ id: 'a' })], '9999').account).toBe(false)
  })

  it('a failed read answers no instead of throwing', async () => {
    const failing = { from: () => ({ select: () => ({ eq: () => ({ is: async () => ({ data: null, error: { message: 'down' } }) }) }) }) } as unknown as ServiceClient
    expect(await readOwnAccount(failing, 'u1', '5124')).toEqual({ account: false, registered: false, registeredId: null })
  })
})

describe('one-leg answer keys', () => {
  it("a missing own tail is stored as '-', which sorts before any digit", () => {
    expect(oneLegTails(null, '5124')).toEqual(['-', '5124'])
    expect(oneLegTails('0001', '5124')).toEqual(['0001', '5124'])
    expect('-' < '00').toBe(true)
  })
})
