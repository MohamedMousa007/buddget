import { describe, expect, it } from 'vitest'
import { HIDDEN, redactBalances } from './redact'

describe('redactBalances', () => {
  it('hides balance-like fields at any depth and keeps everything else', () => {
    const out = redactBalances({ net_worth: 100, pockets: [{ name: 'Trip', bal: 50, goal: 500 }], spent: 20, account: { current_balance: 9, name: 'CIB' } })
    expect(out).toEqual({ net_worth: HIDDEN, pockets: [{ name: 'Trip', bal: HIDDEN, goal: 500 }], spent: 20, account: { current_balance: HIDDEN, name: 'CIB' } })
  })

  it('hides the report and savings totals the model can read as a balance', () => {
    const out = redactBalances({ savings_total: 5, debt_remaining: 6, total_savings: 7, assets: [{ name: 'Gold', value: 8 }], spent: 9 })
    expect(out).toEqual({ savings_total: HIDDEN, debt_remaining: HIDDEN, total_savings: HIDDEN, assets: [{ name: 'Gold', value: HIDDEN }], spent: 9 })
  })

  it('leaves an expense total alone', () => {
    expect(redactBalances({ count: 2, total: 160 })).toEqual({ count: 2, total: 160 })
  })
})
