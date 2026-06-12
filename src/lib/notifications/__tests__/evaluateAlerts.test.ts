import { describe, it, expect } from 'vitest'
import { evaluateAlerts, renderAlertCopy } from '@/lib/notifications/evaluateAlerts'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

const debtNameById = { d1: 'Car loan' }

function baseInput(now: Date) {
  return { now, monthStr: '2026-06', monthStartDay: 1, recurring: [], debtNameById }
}

describe('evaluateAlerts', () => {
  it('fires recurring_due for a payment due today or overdue', () => {
    const now = new Date('2026-06-10T09:00:00Z')
    const out = evaluateAlerts({
      ...baseInput(now),
      recurring: [{ id: 'r1', debtId: 'd1', amount: 500, currency: 'EGP', nextDueDate: '2026-06-10', isActive: true }],
    })
    const due = out.find((a) => a.type === 'recurring_due')
    expect(due?.dedupeKey).toBe('recurring_due:r1:2026-06-10')
    expect(due?.params.debtName).toBe('Car loan')
  })

  it('fires recurring_tomorrow only the day before', () => {
    const now = new Date('2026-06-10T09:00:00Z')
    const out = evaluateAlerts({
      ...baseInput(now),
      recurring: [{ id: 'r1', debtId: 'd1', amount: 500, currency: 'EGP', nextDueDate: '2026-06-11', isActive: true }],
    })
    expect(out.map((a) => a.type)).toContain('recurring_tomorrow')
    expect(out.map((a) => a.type)).not.toContain('recurring_due')
  })

  it('skips inactive payments and unknown debts', () => {
    const now = new Date('2026-06-10T09:00:00Z')
    expect(
      evaluateAlerts({
        ...baseInput(now),
        recurring: [{ id: 'r1', debtId: 'd1', amount: 1, currency: 'EGP', nextDueDate: '2026-06-10', isActive: false }],
      }),
    ).toHaveLength(0)
    expect(
      evaluateAlerts({
        ...baseInput(now),
        recurring: [{ id: 'r1', debtId: 'unknown', amount: 1, currency: 'EGP', nextDueDate: '2026-06-10', isActive: true }],
      }),
    ).toHaveLength(0)
  })

  it('fires month_end within the last 3 days, deduped by month', () => {
    const out = evaluateAlerts(baseInput(new Date('2026-06-29T09:00:00Z')))
    const me = out.find((a) => a.type === 'month_end')
    expect(me?.dedupeKey).toBe('month_end:2026-06')
    // Mid-month: no month-end alert.
    expect(evaluateAlerts(baseInput(new Date('2026-06-10T09:00:00Z'))).some((a) => a.type === 'month_end')).toBe(false)
  })

  it('renders localized copy for EN and AR', () => {
    const now = new Date('2026-06-10T09:00:00Z')
    const [due] = evaluateAlerts({
      ...baseInput(now),
      recurring: [{ id: 'r1', debtId: 'd1', amount: 500, currency: 'EGP', nextDueDate: '2026-06-10', isActive: true }],
    })
    expect(renderAlertCopy(en, due).title).toBe('Car loan')
    expect(renderAlertCopy(ar, due).body).not.toBe(renderAlertCopy(en, due).body)
  })
})
