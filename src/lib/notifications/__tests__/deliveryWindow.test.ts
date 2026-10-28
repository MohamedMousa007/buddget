import { describe, it, expect } from 'vitest'
import { isDeliveryWindow, resolveUserTimeZone } from '@/lib/notifications/deliveryWindow'

describe('isDeliveryWindow', () => {
  it('opens at 09:00 local and closes at 21:00', () => {
    const at = (iso: string, tz: string) => isDeliveryWindow(new Date(iso), tz)
    expect(at('2026-06-10T05:59:00Z', 'Africa/Cairo')).toBe(false) // 08:59
    expect(at('2026-06-10T06:00:00Z', 'Africa/Cairo')).toBe(true) // 09:00
    expect(at('2026-06-10T17:59:00Z', 'Africa/Cairo')).toBe(true) // 20:59
    expect(at('2026-06-10T18:00:00Z', 'Africa/Cairo')).toBe(false) // 21:00
  })
  it('follows the user zone, not UTC', () => {
    expect(isDeliveryWindow(new Date('2026-06-10T14:00:00Z'), 'America/New_York')).toBe(true) // 10:00
    expect(isDeliveryWindow(new Date('2026-06-10T06:00:00Z'), 'America/New_York')).toBe(false) // 02:00
  })
})

describe('resolveUserTimeZone', () => {
  it('falls back to Cairo for null, empty or invalid', () => {
    expect(resolveUserTimeZone(null)).toBe('Africa/Cairo')
    expect(resolveUserTimeZone('')).toBe('Africa/Cairo')
    expect(resolveUserTimeZone('Mars/Base')).toBe('Africa/Cairo')
    expect(resolveUserTimeZone('Asia/Dubai')).toBe('Asia/Dubai')
  })
})
