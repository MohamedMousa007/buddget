import { describe, expect, it } from 'vitest'
import { parseSmsDay } from '@/lib/sms/parseSmsDay'
import { pocketIdentity } from '@/lib/savings/pocketIdentity'
import { resolveUserTimeZone } from '@/lib/server/userTimeZone'
import { weekendFirstDayFor } from '@/lib/time/weekStart'

const DAY = 86_400_000
const p2 = (n: number) => String(n).padStart(2, '0')

describe('DBI-1: dd/mm/yy vs yy/mm/dd', () => {
  it.each([
    ['26/10/24', '2026-10-24T08:00:00Z', '2026-10-24'],
    ['26/10/25', '2026-10-25T18:00:00Z', '2026-10-25'],
    ['26/07/09', '2026-07-09T08:00:00Z', '2026-07-09'],
    ['26/07/30', '2026-07-30T08:00:00Z', '2026-07-30'],
    ['24/10/26', '2026-10-24T08:00:00Z', '2026-10-24'],
    ['24-10-26 14:35', '2026-10-24T08:00:00Z', '2026-10-24'],
  ])('%s received %s -> %s', (raw, at, want) => expect(parseSmsDay(raw, at)).toBe(want))

  it('a first field above 31 is a year; an impossible reading is never invented', () => {
    expect(parseSmsDay('45/01/05', '2045-01-05T08:00:00Z')).toBe('2045-01-05')
    expect(parseSmsDay('31APR26')).toBeNull()
  })
  it('an explicit 4-digit year is respected', () => {
    expect(parseSmsDay('05/03/2024', '2026-10-24T08:00:00Z')).toBe('2024-03-05')
  })
  it('a 2-digit date more than a year from the receive time falls back to it (null)', () => {
    expect(parseSmsDay('05/05/09', '2026-10-24T08:00:00Z')).toBeNull()
  })

  it('property: for generated dates in both orders and every separator the result is within 35 days of the receive time', () => {
    let seed = 20261106
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    let n = 0
    for (let i = 0; i < 6000; i++) {
      const received = Date.UTC(2026, 0, 1) + Math.floor(rnd() * 365 * 3 * DAY)
      const real = new Date(received + Math.floor((rnd() * 70 - 35) * DAY * 0.9))
      const y = real.getUTCFullYear() % 100, m = real.getUTCMonth() + 1, d = real.getUTCDate()
      const sep = ['/', '-', '.'][Math.floor(rnd() * 3)]
      const text = rnd() < 0.5 ? [p2(d), p2(m), p2(y)].join(sep) : [p2(y), p2(m), p2(d)].join(sep)
      const got = parseSmsDay(text, new Date(received))
      n++
      if (got === null) continue
      expect(Math.abs(Date.parse(`${got}T00:00:00Z`) - received)).toBeLessThanOrEqual(36 * DAY)
    }
    expect(n).toBe(6000)
  })
  it('property: a date near the receive time is never lost to the wrong order', () => {
    for (let off = -30; off <= 30; off++) {
      const received = Date.UTC(2026, 9, 24, 12) + off * DAY
      const real = new Date(received)
      const y = real.getUTCFullYear() % 100, m = real.getUTCMonth() + 1, d = real.getUTCDate()
      const want = `${real.getUTCFullYear()}-${p2(m)}-${p2(d)}`
      expect(parseSmsDay(`${p2(d)}/${p2(m)}/${p2(y)}`, new Date(received))).toBe(want)
      expect(parseSmsDay(`${p2(y)}/${p2(m)}/${p2(d)}`, new Date(received))).toBe(want)
    }
  })
})

describe('REG-2 / TZL-1: one default zone for server and client', () => {
  it('an unset or invalid zone resolves to Cairo, whose weekend is Fri+Sat', () => {
    expect(resolveUserTimeZone(null)).toBe('Africa/Cairo')
    expect(resolveUserTimeZone('nope/zone')).toBe('Africa/Cairo')
    expect(resolveUserTimeZone('Asia/Dubai')).toBe('Asia/Dubai')
    expect(weekendFirstDayFor({ timezone: resolveUserTimeZone(undefined) })).toBe(5)
  })
})

describe('TZL-3: a maturity date is the same calendar month in every zone', () => {
  const identity = { types: {}, matures: (m: string, y: number) => `${m} ${y}` } as never
  it('1 Jan 2027 reads Jan 2027, in English and Arabic', () => {
    const acct = { type: 'bank', name: 'n', maturityDate: '2027-01-01' } as never
    expect(pocketIdentity(acct, identity)).toBe('Jan 2027')
    expect(pocketIdentity(acct, identity, 'ar')).toBe('يناير 2027')
  })
})
