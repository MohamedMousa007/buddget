import { describe, expect, it } from 'vitest'
import { parseZakatLine, resolveLineEdit } from '@/lib/savings/zakatLineInput'

describe('parseZakatLine', () => {
  it('reads grouped, decimal and Arabic-digit input', () => {
    expect(parseZakatLine('12,500')).toBe(12500)
    expect(parseZakatLine('١٢٥٠٠')).toBe(12500)
    expect(parseZakatLine('1,250.5')).toBe(1250.5)
    expect(parseZakatLine('1,5')).toBe(1.5)
    expect(parseZakatLine('0,5')).toBe(0.5)
  })
  it('returns null for empty or unreadable text instead of 0', () => {
    expect(parseZakatLine('')).toBeNull()
    expect(parseZakatLine('  ')).toBeNull()
    expect(parseZakatLine('abc')).toBeNull()
  })
})

describe('resolveLineEdit', () => {
  it('keeps the live value when the text was only focused, not changed', () => {
    expect(resolveLineEdit('12,346', 12345.6, undefined)).toEqual({ kind: 'keep' })
  })
  it('clears an override when the field is emptied', () => {
    expect(resolveLineEdit('', 100, 50)).toEqual({ kind: 'clear' })
  })
  it('ignores unreadable text rather than zeroing the line', () => {
    expect(resolveLineEdit('abc', 100, undefined)).toEqual({ kind: 'keep' })
  })
  it('sets an override for a real change', () => {
    expect(resolveLineEdit('500', 100, undefined)).toEqual({ kind: 'set', value: 500 })
  })
  it('allows an explicit zero', () => {
    expect(resolveLineEdit('0', 100, undefined)).toEqual({ kind: 'set', value: 0 })
  })
})
