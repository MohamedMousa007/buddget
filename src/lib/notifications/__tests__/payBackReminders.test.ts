import { describe, it, expect } from 'vitest'
import { evaluateAlerts, renderAlertCopy } from '@/lib/notifications/evaluateAlerts'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { wallClockNow } from '@/lib/time/deviceTimeZone'

// The cron passes `wallClockNow(utcNow, userZone)`: a Date whose local fields read as the user's wall clock. Build `now` the
// same way (10:00 in Cairo) so the expected day never depends on the zone the tests run in.
const at = (ymd: string, timeZone = 'Africa/Cairo') => wallClockNow(new Date(`${ymd}T08:00:00Z`), timeZone)
const input = (now: Date, dueDate: string) => ({
  now, monthStr: '2026-06', monthStartDay: 1, recurring: [], debtNameById: {},
  payBack: [{ debtId: 'd1', name: 'Omar', dueDate }],
})
const reminders = (now: Date, dueDate: string) => evaluateAlerts(input(now, dueDate)).filter((a) => a.type === 'debt_reminder')

describe('pay-back-by reminders for debts you owe', () => {
  it('reminds the day before, on the day, and on overdue days 1, 3, 7, 14, 21, 28 only', () => {
    const due = '2026-06-10'
    const fired = Array.from({ length: 40 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 5, 8 + i)).toISOString().slice(0, 10)
      return reminders(at(day), due).length ? i - 2 : null
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

  it('counts days on the user\'s own calendar: late evening in Cairo is already the next day, while New York is still on the due day', () => {
    // 23:30 UTC on Jun 10 is 02:30 on Jun 11 in Cairo (day 1 overdue) and 19:30 on Jun 10 in New York (due today).
    const utc = new Date('2026-06-10T23:30:00Z')
    expect(evaluateAlerts(input(wallClockNow(utc, 'Africa/Cairo'), '2026-06-10')).find((a) => a.type === 'debt_reminder')?.params.daysLate).toBe(1)
    expect(evaluateAlerts(input(wallClockNow(utc, 'America/New_York'), '2026-06-10')).find((a) => a.type === 'debt_reminder')?.params.daysLate).toBe(0)
  })

  it('no pay-back list, no reminders', () => {
    expect(evaluateAlerts({ ...input(at('2026-06-10'), '2026-06-10'), payBack: undefined }).some((a) => a.type === 'debt_reminder')).toBe(false)
  })
})
