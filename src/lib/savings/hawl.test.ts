import { describe, it, expect } from 'vitest'
import { deriveHawl, LUNAR_YEAR_DAYS } from './hawl'

/**
 * The precedence here is the whole point. Before this existed the due date was always
 * 354 days from account creation — the day someone installed a budgeting app — and it
 * was shown as "due by <date>" with no hedging. These pin the order and, just as
 * importantly, that the fallback admits what it is.
 */
describe('deriveHawl', () => {
  const createdAt = '2024-01-01'

  it('uses the anchor the user set, over everything else', () => {
    const h = deriveHawl({ yearStartDate: '2026-03-01', lastPaidDate: '2025-06-01', createdAt })
    expect(h.dueDate).toBe('2027-02-18') // 2026-03-01 + 354d
    expect(h.isPlaceholder).toBe(false)
  })

  it('falls back to the last payment, and that is a real anchor too', () => {
    const h = deriveHawl({ lastPaidDate: '2025-06-01', createdAt })
    expect(h.dueDate).toBe('2026-05-21')
    expect(h.isPlaceholder).toBe(false)
  })

  it('reads a late-night payment timestamp as the local day', () => {
    const h = deriveHawl({ lastPaidDate: '2025-05-31T22:30:00.000Z', createdAt })
    expect(h.dueDate).toBe('2026-05-21')
  })

  it('falls back to account creation but marks it a placeholder', () => {
    const h = deriveHawl({ createdAt })
    expect(h.dueDate).toBe('2024-12-20')
    // The UI keys off this to stop presenting an install date as a religious one.
    expect(h.isPlaceholder).toBe(true)
  })

  it('treats an empty or unparseable anchor as absent rather than crashing', () => {
    for (const bad of ['', '   ', 'not-a-date', null, undefined]) {
      const h = deriveHawl({ yearStartDate: bad as string | null, createdAt })
      expect(h.dueDate).toBe('2024-12-20')
      expect(h.isPlaceholder).toBe(true)
    }
  })

  it('counts a lunar year, not a solar one', () => {
    const h = deriveHawl({ yearStartDate: '2026-01-01', createdAt })
    const days = (new Date(h.dueDate).getTime() - new Date('2026-01-01').getTime()) / 86_400_000
    expect(days).toBe(LUNAR_YEAR_DAYS)
    expect(days).toBeLessThan(365)
  })
})
