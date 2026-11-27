import { describe, it, expect } from 'vitest'
import { evaluateAlerts, renderAlertCopy } from '@/lib/notifications/evaluateAlerts'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

const at = (ymd: string) => new Date(`${ymd}T09:00:00Z`)
const input = (now: Date, dueDate: string) => ({
  now, monthStr: '2026-06', monthStartDay: 1, recurring: [], debtNameById: {},
  payBack: [{ debtId: 'd1', name: 'Omar', dueDate }],
})
const reminders = (now: Date, dueDate: string) => evaluateAlerts(input(now, dueDate)).filter((a) => a.type === 'debt_reminder')

describe('pay-back-by reminders for debts you owe', () => {
  it('reminds the day before, on the day, and on overdue days 1, 3, 7, 14, 21, 28 only', () => {
    const due = '2026-06-10'
    const fired = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 5, 8 + i))
      return reminders(d, due).length ? i - 2 : null
    }).filter((x) => x !== null)
    expect(fired).toEqual([-1, 0, 1, 3, 7, 14, 21, 28])
  })

  it('each reminder has its own dedupe key and the right severity', () => {
    const before = reminders(at('2026-06-09'), '2026-06-10')[0]
    const late = reminders(at('2026-06-13'), '2026-06-10')[0]
    expect(before.dedupeKey).toBe('debt_reminder:d1:2026-06-10:-1')
    expect(before.severity).toBe('info')
    expect(late.dedupeKey).toBe('debt_reminder:d1:2026-06-10:3')
    expect(late.severity).toBe('warning')
  })

  it('renders English and Arabic copy for tomorrow, today and overdue', () => {
    for (const dict of [en, ar]) {
      for (const day of ['2026-06-09', '2026-06-10', '2026-06-17']) {
        const { title, body } = renderAlertCopy(dict, reminders(at(day), '2026-06-10')[0])
        expect(title).toBe('Omar')
        expect(body).toContain('Omar')
      }
    }
    expect(renderAlertCopy(en, reminders(at('2026-06-17'), '2026-06-10')[0]).body).toContain('7 days ago')
  })

  it('no pay-back list, no reminders', () => {
    expect(evaluateAlerts({ ...input(at('2026-06-10'), '2026-06-10'), payBack: undefined }).some((a) => a.type === 'debt_reminder')).toBe(false)
  })
})
