import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { resetBillingSwitchCache } from '@/lib/entitlements/billingSwitch'
import { namesUntrackedAccount } from './createSmsExpense'

type Method = { id: string; name: string; last4: string; last4_aliases: string[]; provisional: boolean; closed_at: null; type: string; parent_id: string | null; track_sms: boolean }

const bank = (over: Partial<Method> = {}): Method => ({ id: 'm1', name: 'CIB', last4: '1234', last4_aliases: [], provisional: false, closed_at: null, type: 'account', parent_id: null, track_sms: false, ...over })

/** A service that answers the method list, a method by id, and the billing switch. */
function service(methods: Method[], billing: boolean) {
  return {
    rpc: async () => ({ data: billing, error: null }),
    from: () => {
      let id: string | null = null
      const q = {
        select: () => q,
        eq: (col: string, val: string) => { if (col === 'id') id = val; return q },
        is: () => q,
        maybeSingle: async () => ({ data: methods.find((m) => m.id === id) ?? null, error: null }),
        then: (res: (v: unknown) => unknown) => res({ data: methods, error: null }),
      }
      return q
    },
  } as never
}

beforeEach(() => resetBillingSwitchCache())

describe('namesUntrackedAccount (free SMS account cap, S5c item 18)', () => {
  it('holds a message for an account the cap left untracked, only while billing is on', async () => {
    expect(await namesUntrackedAccount(service([bank()], true), 'u', '1234')).toBe(true)
    resetBillingSwitchCache()
    expect(await namesUntrackedAccount(service([bank()], false), 'u', '1234')).toBe(false)
  })

  it('never holds a tracked account, an unknown one, or a message with no digits', async () => {
    expect(await namesUntrackedAccount(service([bank({ track_sms: true })], true), 'u', '1234')).toBe(false)
    resetBillingSwitchCache()
    expect(await namesUntrackedAccount(service([bank()], true), 'u', '9999')).toBe(false)
    expect(await namesUntrackedAccount(service([bank()], true), 'u', null)).toBe(false)
  })

  it('never holds cash', async () => {
    expect(await namesUntrackedAccount(service([bank({ type: 'cash' })], true), 'u', '1234')).toBe(false)
  })

  it('lets a card follow its account: the card is held when the account is untracked, and not when it is tracked', async () => {
    const parent = bank({ id: 'p', last4: '5555', track_sms: false })
    const card = bank({ id: 'c', last4: '1234', parent_id: 'p', track_sms: true, type: 'card' })
    expect(await namesUntrackedAccount(service([parent, card], true), 'u', '1234')).toBe(true)
    resetBillingSwitchCache()
    expect(await namesUntrackedAccount(service([{ ...parent, track_sms: true }, card], true), 'u', '1234')).toBe(false)
  })
})
