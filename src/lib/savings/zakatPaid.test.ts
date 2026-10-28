import { describe, expect, it } from 'vitest'
import { markZakatPaid, undoZakatPaid } from '@/lib/savings/zakatPaid'
import { deriveHawl } from '@/lib/savings/hawl'
import type { ZakatConfig } from '@/lib/store/types'

const cfg: ZakatConfig = { nisabBasis: 'gold', holdsForTrading: false, yearStartDate: '2025-03-01', lineOverrides: { cash: 5 } }

describe('mark zakat as paid', () => {
  it('records the payment and restarts the hawl from today, keeping the rest of the calculation', () => {
    const next = markZakatPaid(cfg, '2026-10-28', '2026-10-28T10:00:00.000Z')
    expect(next.lastPaidDate).toBe('2026-10-28T10:00:00.000Z')
    expect(next.yearStartDate).toBe('2026-10-28')
    expect(next.lineOverrides).toEqual({ cash: 5 })
    expect(deriveHawl({ yearStartDate: next.yearStartDate, lastPaidDate: next.lastPaidDate, createdAt: '2025-01-01' }).dueDate).toBe('2027-10-17')
  })

  it('undo restores the earlier dates', () => {
    const next = markZakatPaid(cfg, '2026-10-28', '2026-10-28T10:00:00.000Z')
    const back = undoZakatPaid(next, cfg)
    expect(back.yearStartDate).toBe('2025-03-01')
    expect(back.lastPaidDate).toBeUndefined()
  })
})
