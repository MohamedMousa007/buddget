import { describe, it, expect } from 'vitest'
import {
  eventDaysLate,
  missedAfterDaysFor,
  pendingStatus,
  MAX_DISPLAYED_LATE_DAYS,
  MISSED_AFTER_DAYS,
} from './incomeOccurrences'
import type { IncomeSource } from '@/lib/store/types'

describe('eventDaysLate', () => {
  it('reports the gap between the payday and the day the money landed', () => {
    expect(eventDaysLate({ occurrenceDate: '2026-07-20', receivedDate: '2026-07-23' })).toBe(3)
  })

  it('is silent for an on-time or early receipt', () => {
    expect(eventDaysLate({ occurrenceDate: '2026-07-20', receivedDate: '2026-07-20' })).toBeNull()
    expect(eventDaysLate({ occurrenceDate: '2026-07-20', receivedDate: '2026-07-17' })).toBeNull()
  })

  it('is silent for a legacy event with no payday stamped', () => {
    expect(eventDaysLate({ occurrenceDate: null, receivedDate: '2026-07-23' })).toBeNull()
  })

  it('refuses to report a stale backfill as lateness', () => {
    // Marking a June payday received in October measures when the user got round to it,
    // not when the employer paid — a "112 days late" chip would be a lie.
    expect(eventDaysLate({ occurrenceDate: '2026-06-20', receivedDate: '2026-10-10' })).toBeNull()
    // The boundary itself still reports.
    expect(eventDaysLate({ occurrenceDate: '2026-07-01', receivedDate: '2026-08-01' })).toBe(MAX_DISPLAYED_LATE_DAYS)
  })
})

describe('pendingStatus with a per-source grace', () => {
  it('keeps the app default when no grace is given', () => {
    expect(pendingStatus('2026-07-20', '2026-07-25')).toBe('late')
    expect(pendingStatus('2026-07-20', '2026-07-26')).toBe('missed')
  })

  it('holds an unpaid payday at late for a source that pays whenever', () => {
    // 14-day grace ("Whenever"): still late on day 14, missed on day 15.
    expect(pendingStatus('2026-07-20', '2026-08-03', 14)).toBe('late')
    expect(pendingStatus('2026-07-20', '2026-08-04', 14)).toBe('missed')
  })

  it('flags a punctual employer the day after payday', () => {
    // 0-day grace ("On time"): a day past due is already missed.
    expect(pendingStatus('2026-07-20', '2026-07-21', 0)).toBe('missed')
    expect(pendingStatus('2026-07-20', '2026-07-20', 0)).toBe('awaiting')
  })

  it('never treats a future payday as overdue, whatever the grace', () => {
    expect(pendingStatus('2026-08-20', '2026-07-24', 0)).toBe('awaiting')
  })
})

describe('missedAfterDaysFor', () => {
  const src = (paydayDriftDays: number | null | undefined) =>
    ({ paydayDriftDays }) as Pick<IncomeSource, 'paydayDriftDays'>

  it('uses the source grace when set — including zero', () => {
    expect(missedAfterDaysFor(src(14))).toBe(14)
    expect(missedAfterDaysFor(src(0))).toBe(0)
  })

  it('falls back to the app default for legacy rows', () => {
    expect(missedAfterDaysFor(src(null))).toBe(MISSED_AFTER_DAYS)
    expect(missedAfterDaysFor(src(undefined))).toBe(MISSED_AFTER_DAYS)
  })
})
