import { describe, it, expect } from 'vitest'
import { nextValue, formatAmount } from './NumberPad'

describe('nextValue (decimal)', () => {
  const d = (v: string, k: string) => nextValue(v, k, 'decimal')
  it('appends digits', () => expect(d('12', '3')).toBe('123'))
  it('collapses leading-zero runs', () => expect(d('0', '5')).toBe('5'))
  it('keeps a single zero', () => expect(d('0', '0')).toBe('0'))
  it('inserts a decimal once', () => expect(d('12', '.')).toBe('12.'))
  it('ignores a second decimal', () => expect(d('1.2', '.')).toBe('1.2'))
  it('empty + dot becomes 0.', () => expect(d('', '.')).toBe('0.'))
  it('caps at 2 decimal places', () => expect(d('1.23', '4')).toBe('1.23'))
  it('backspace removes last char', () => expect(d('1.2', 'back')).toBe('1.'))
})

describe('nextValue (integer)', () => {
  const i = (v: string, k: string) => nextValue(v, k, 'integer')
  it('appends digits with no cap', () => expect(i('123456', '7')).toBe('1234567'))
  it('collapses leading zero', () => expect(i('0', '5')).toBe('5'))
  it('ignores the decimal key', () => expect(i('12', '.')).toBe('12'))
  it('backspace removes last char', () => expect(i('12', 'back')).toBe('1'))
})

describe('nextValue (pin)', () => {
  const p = (v: string, k: string) => nextValue(v, k, 'pin')
  it('appends up to 4 digits', () => expect(p('123', '4')).toBe('1234'))
  it('hard-caps at 4', () => expect(p('1234', '5')).toBe('1234'))
  it('ignores the decimal key', () => expect(p('12', '.')).toBe('12'))
})

describe('formatAmount', () => {
  it('groups thousands', () => expect(formatAmount('1250')).toBe('1,250'))
  it('keeps decimals as typed', () => expect(formatAmount('1250.5')).toBe('1,250.5'))
  it('empty is 0', () => expect(formatAmount('')).toBe('0'))
  it('trailing dot preserved', () => expect(formatAmount('12.')).toBe('12.'))
})
