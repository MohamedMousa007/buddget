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

  it('hides net-worth components, debt positions and goal progress', () => {
    const out = redactBalances({ net_worth: 1, savings: 2, investments: 3, debt: 4, month_flow: 5, owe: 6, owedToYou: 7, debts: [{ name: 'Car', left: 8, each: 9, paymentsLeft: 3 }], goals: [{ name: 'Trip', target: 10, saved: 11, need_mo: 12, pct: 40 }], left_to_spend: 13, days_left: 5 })
    expect(out).toEqual({ net_worth: HIDDEN, savings: HIDDEN, investments: HIDDEN, debt: HIDDEN, month_flow: HIDDEN, owe: HIDDEN, owedToYou: HIDDEN, debts: [{ name: 'Car', left: HIDDEN, each: HIDDEN, paymentsLeft: 3 }], goals: [{ name: 'Trip', target: HIDDEN, saved: HIDDEN, need_mo: HIDDEN, pct: 40 }], left_to_spend: HIDDEN, days_left: 5 })
  })

  it('masks numbers only so status fields stay readable', () => {
    expect(redactBalances({ name: 'Netflix', paid: true, left: 'soon', value: 'n/a', limit: 500 })).toEqual({ name: 'Netflix', paid: true, left: 'soon', value: 'n/a', limit: HIDDEN })
  })
})
