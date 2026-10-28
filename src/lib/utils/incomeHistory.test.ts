import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { actualIncomeForMonth, filterDebtPaymentsByMonth, recurringActiveForWindow, getMonthRange } from './calculations'
import { localDayKey } from './localDate'
import type { IncomeSource, IncomeEvent, DebtPayment } from '@/lib/store/types'

// The R11 cases are about the Cairo wall clock, so pin the zone for this file regardless of the runner's TZ.
const realTz = process.env.TZ
beforeAll(() => { process.env.TZ = 'Africa/Cairo' })
afterAll(() => { if (realTz === undefined) delete process.env.TZ; else process.env.TZ = realTz })

const tmpl = (p: Partial<IncomeSource> = {}): IncomeSource =>
  ({
    id: 't1', name: 'Salary', amount: 5000, currency: 'EGP', isRecurring: true, dayOfMonth: 1,
    recurringFrequency: 'monthly', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    effectiveStart: '2024-01-01', ...p,
  }) as IncomeSource

const evt = (p: Partial<IncomeEvent>): IncomeEvent => ({
  id: 'e1', name: 'Salary', amount: 5000, currency: 'EGP', receivedDate: '2025-01-01', status: 'confirmed',
  createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', ...p,
})

describe('L1/R3 received events survive a deleted or ended source', () => {
  it('deleted source: confirmed event still counts', () => {
    const events = [evt({ templateId: 't1', occurrenceDate: '2025-01-01' })]
    expect(actualIncomeForMonth([], events, 'EGP', {}, '2025-01', 1)).toBe(5000)
  })
  it('deleted source: missed/projected orphan counts 0', () => {
    const events = [evt({ templateId: 't1', status: 'missed' }), evt({ id: 'e2', templateId: 't1', status: 'projected' })]
    expect(actualIncomeForMonth([], events, 'EGP', {}, '2025-01', 1)).toBe(0)
  })
  it('ended source: event in a month after the end still counts', () => {
    const t = tmpl({ effectiveEnd: '2024-12-31' })
    const events = [evt({ templateId: 't1', occurrenceDate: '2025-01-01' })]
    expect(actualIncomeForMonth([t], events, 'EGP', {}, '2025-01', 1)).toBe(5000)
  })
  it('live source is unchanged (no double count)', () => {
    const events = [evt({ templateId: 't1', occurrenceDate: '2025-01-01' })]
    expect(actualIncomeForMonth([tmpl()], events, 'EGP', {}, '2025-01', 1)).toBe(5000)
  })
})

describe('R11 local-day semantics (TZ=Africa/Cairo)', () => {
  it('localDayKey converts an ISO instant to the local day', () => {
    expect(localDayKey('2026-10-31T23:30:00.000Z')).toBe('2026-11-01')
    expect(localDayKey('2026-10-31')).toBe('2026-10-31')
  })
  it('debt payment at 01:30 Cairo on 1 Nov lands in November', () => {
    const p = { id: 'p', debtId: 'd', date: '2026-10-31T23:30:00.000Z', amountPaid: 10 } as DebtPayment
    expect(filterDebtPaymentsByMonth([p], '2026-10', 1)).toHaveLength(0)
    expect(filterDebtPaymentsByMonth([p], '2026-11', 1)).toHaveLength(1)
  })
  it('source created 01:30 Cairo on 1 Nov is active for November window start', () => {
    const s = tmpl({ effectiveStart: undefined, createdAt: '2026-10-31T23:30:00.000Z' })
    const oct = getMonthRange('2026-10', 1)
    expect(recurringActiveForWindow(s, oct.start, oct.end)).toBe(false)
  })
})
