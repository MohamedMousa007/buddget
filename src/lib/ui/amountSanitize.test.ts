import { describe, it, expect } from 'vitest'
import { sanitizeAmount } from './amountSanitize'

describe('sanitizeAmount', () => {
  it('converts Arabic-Indic digits and decimal separators', () => {
    expect(sanitizeAmount('١٢٣٫٤٥')).toBe('123.45')
    expect(sanitizeAmount('۱۲,۵')).toBe('12.5')
  })
  it('keeps a single dot and max 2 decimals', () => {
    expect(sanitizeAmount('1.2.3')).toBe('1.2')
    expect(sanitizeAmount('1.999')).toBe('1.99')
    expect(sanitizeAmount('5.')).toBe('5.')
  })
  it('strips junk and caps at 12 integer digits', () => {
    expect(sanitizeAmount('EGP 1abc2')).toBe('12')
    expect(sanitizeAmount('1234567890123456')).toBe('123456789012')
  })
  it('integer and pin modes are digits only', () => {
    expect(sanitizeAmount('12.5', 'integer')).toBe('125')
    expect(sanitizeAmount('12345', 'pin')).toBe('1234')
    expect(sanitizeAmount('1a2', 'pin')).toBe('12')
  })
})
