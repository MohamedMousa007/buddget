import { describe, expect, it } from 'vitest'
import { debtFreeMonth } from '@/lib/budget/debtPayoff'

const now = new Date(2026, 9, 19)

describe('debtFreeMonth', () => {
  it('is null without debts', () => {
    expect(debtFreeMonth([], 100, now)).toBeNull()
  })

  it('interest-free minimums clear in balance / minimum payments', () => {
    expect(debtFreeMonth([{ balance: 1200, minimum: 100, apr: null }], 0, now)).toBe('2027-09')
  })

  it('an extra payment shortens it', () => {
    expect(debtFreeMonth([{ balance: 1200, minimum: 100, apr: 0 }], 100, now)).toBe('2027-03')
  })

  it('never clears when the minimum does not cover interest', () => {
    expect(debtFreeMonth([{ balance: 10000, minimum: 50, apr: 24 }], 0, now)).toBeNull()
  })

  it('never clears with no payment at all', () => {
    expect(debtFreeMonth([{ balance: 500, minimum: 0, apr: null }], 0, now)).toBeNull()
  })

  it('rolls a cleared minimum onto the remaining debt', () => {
    const rolled = debtFreeMonth([{ balance: 100, minimum: 100, apr: null }, { balance: 1000, minimum: 100, apr: null }], 0, now)
    expect(rolled).toBe('2027-02')
  })

  it('sends the extra to the highest rate', () => {
    const high = { balance: 1000, minimum: 50, apr: 30 }
    const low = { balance: 1000, minimum: 50, apr: 2 }
    const a = debtFreeMonth([high, low], 500, now)
    const b = debtFreeMonth([{ ...low }, { ...high }], 500, now)
    expect(a).toBe(b)
  })

  it('ignores a debt already at zero', () => {
    expect(debtFreeMonth([{ balance: 0, minimum: 100, apr: null }], 0, now)).toBeNull()
  })
})
