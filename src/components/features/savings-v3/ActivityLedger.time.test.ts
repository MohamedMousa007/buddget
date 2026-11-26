import { describe, expect, it } from 'vitest'
import { formatClock } from '@/lib/i18n/dateFormat'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { ledgerClock } from './ActivityLedger'

describe('Wealth recent moves show the stored time (live QA: 7:24 AM read back as 12:00 PM)', () => {
  it('reads occurredAt, not noon of the day', () => {
    const at = manualOccurredAt('2026-11-20', '07:24')
    expect(ledgerClock({ date: '2026-11-20', occurredAt: at }, 'en')).toBe(formatClock(new Date(at), 'en'))
    expect(ledgerClock({ date: '2026-11-20', occurredAt: at }, 'en')).not.toBe(formatClock(new Date('2026-11-20T12:00:00'), 'en'))
  })
  it('a row with no stored time still reads noon of its day', () => {
    expect(ledgerClock({ date: '2026-11-20' }, 'en')).toBe(formatClock(new Date('2026-11-20T12:00:00'), 'en'))
  })
})
