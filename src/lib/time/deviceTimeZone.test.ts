import { describe, it, expect } from 'vitest'
import { timeZoneUpdate, wallClockNow } from './deviceTimeZone'
import { settingsToRow, settingsFromRow } from '@/lib/supabase/remote/mappers/settingsMapper'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'

describe('timeZoneUpdate', () => {
  it('writes the device zone when unset', () => expect(timeZoneUpdate(undefined, 'Asia/Dubai')).toBe('Asia/Dubai'))
  it('writes when it differs (travel)', () => expect(timeZoneUpdate('Africa/Cairo', 'America/New_York')).toBe('America/New_York'))
  it('no-op when equal', () => expect(timeZoneUpdate('Asia/Dubai', 'Asia/Dubai')).toBeNull())
  it('ignores an invalid or empty device zone', () => {
    expect(timeZoneUpdate(undefined, 'Not/AZone')).toBeNull()
    expect(timeZoneUpdate(undefined, undefined)).toBeNull()
  })
})

describe('wallClockNow', () => {
  it('shows the user local wall time', () => {
    const d = wallClockNow(new Date('2026-08-01T22:30:00Z'), 'Asia/Dubai')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 2, 2])
  })
})

describe('settings mapper timezone', () => {
  it('round-trips', () => {
    const row = settingsToRow({ ...DEFAULT_SETTINGS, timezone: 'Asia/Dubai' }, 'u')
    expect(row.timezone).toBe('Asia/Dubai')
    expect(settingsFromRow({ ...row, timezone: 'Asia/Dubai' } as never, { baseCurrency: 'EGP', secondaryCurrency: null }).timezone).toBe('Asia/Dubai')
  })
  it('omits when unset so a device without one cannot erase the account value', () => {
    expect('timezone' in settingsToRow(DEFAULT_SETTINGS, 'u')).toBe(false)
  })
})
