import { describe, expect, it } from 'vitest'
import { HIDDEN, redactBalances } from './redact'

describe('redactBalances', () => {
  it('hides balance-like fields at any depth and keeps everything else', () => {
    const out = redactBalances({ net_worth: 100, pockets: [{ name: 'Trip', bal: 50, goal: 500 }], spent: 20, account: { current_balance: 9, name: 'CIB' } })
    expect(out).toEqual({ net_worth: HIDDEN, pockets: [{ name: 'Trip', bal: HIDDEN, goal: 500 }], spent: 20, account: { current_balance: HIDDEN, name: 'CIB' } })
  })
})
