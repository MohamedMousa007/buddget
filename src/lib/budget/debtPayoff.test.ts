import { describe, expect, it } from 'vitest'
import { debtFreeMonth } from '@/lib/budget/debtPayoff'

const now = new Date(2026, 9, 19)

describe('debtFreeMonth', () => {
  it('is null without debts', () => {
    expect(debtFreeMonth([], 100, now)).toBeNull()
  })

  it('interest-free minimums clear in balance / minimum payments', () => {
    expect(debtFreeMonth([{ balance: 1200, minimum: 100 }], 0, now)).toBe('2027-09')
  })

  it('an extra payment shortens it', () => {
    expect(debtFreeMonth([{ balance: 1200, minimum: 100 }], 100, now)).toBe('2027-03')
  })

  it('never clears with no payment at all', () => {
    expect(debtFreeMonth([{ balance: 500, minimum: 0 }], 0, now)).toBeNull()
  })

  it('rolls a cleared minimum onto the remaining debt', () => {
    const rolled = debtFreeMonth([{ balance: 100, minimum: 100 }, { balance: 1000, minimum: 100 }], 0, now)
    expect(rolled).toBe('2027-03')
  })

  it('sends the extra to the smallest balance, whatever order the debts come in', () => {
    const small = { balance: 400, minimum: 50 }
    const big = { balance: 4000, minimum: 50 }
    expect(debtFreeMonth([small, big], 500, now)).toBe(debtFreeMonth([{ ...big }, { ...small }], 500, now))
  })

  it('ignores a debt already at zero', () => {
    expect(debtFreeMonth([{ balance: 0, minimum: 100 }], 0, now)).toBeNull()
  })

  it('a smaller final payment rolls only its leftover that month, the full minimum after', () => {
    // A: 150 at 100/mo clears in month 2 paying 50; B takes the spare 50 then 100 + 100 from the next month.
    expect(debtFreeMonth([{ balance: 150, minimum: 100 }, { balance: 1000, minimum: 100 }], 0, now)).toBe('2027-03')
  })
})
