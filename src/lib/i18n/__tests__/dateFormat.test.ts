import { describe, expect, it } from 'vitest'
import { formatClock, formatLocalized, intlTag, monthNames, weekdayNames } from '../dateFormat'

const D = new Date(2026, 9, 5, 15, 30)

describe('dateFormat', () => {
  it('names months and weekdays in Arabic, Latin digits', () => {
    expect(formatLocalized(D, 'd MMM yyyy', 'ar')).toBe('5 أكتوبر 2026')
    expect(formatLocalized(D, 'EEEE, d MMMM', 'ar')).toMatch(/^الاثنين، 5 أكتوبر$|^الاثنين, 5 أكتوبر$/)
    expect(formatLocalized(D, 'd MMM yyyy', 'en')).toBe('5 Oct 2026')
  })
  it('exposes one month/weekday table per locale', () => {
    expect(monthNames('ar')[0]).toBe('يناير')
    expect(monthNames('en', 'short')[9]).toBe('Oct')
    expect(weekdayNames('en', 'short')[0]).toBe('Sun')
    expect(weekdayNames('ar', 'long')[6]).toBe('السبت')
  })
  it('never emits Arabic-Indic digits', () => {
    expect(intlTag('ar')).toBe('ar-EG-u-nu-latn')
    expect(formatClock(D, 'ar', true)).toMatch(/^3:30/)
    expect(formatClock(D, 'ar')).not.toMatch(/[٠-٩]/)
  })
  it('clock follows the device 12/24-hour choice, never with seconds', () => {
    expect(formatClock(D, 'en', true)).toBe('3:30 PM')
    expect(formatClock(D, 'en', false)).toBe('15:30')
    expect(formatClock(new Date(2026, 9, 5, 9, 5), 'en', false)).toBe('09:05')
    expect(formatClock(D, 'ar', false)).toBe('15:30')
  })
})

describe('formatLocalized invalid date', () => {
  it('returns an empty string instead of throwing', () => {
    expect(formatLocalized(new Date(NaN), 'MMM d', 'en')).toBe('')
  })
})
