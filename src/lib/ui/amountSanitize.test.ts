import { describe, it, expect } from 'vitest'
import { amountCharsBefore, amountInputText, caretInGrouped, groupAmountText, sanitizeAmount, sanitizeGroupedAmount } from './amountSanitize'

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

describe('grouped amount entry (AmountHero shows 2,000 while typing)', () => {
  it('groups the integer part only, keeping a trailing dot and typed decimals', () => {
    expect(groupAmountText('')).toBe('')
    expect(groupAmountText('2000')).toBe('2,000')
    expect(groupAmountText('50000')).toBe('50,000')
    expect(groupAmountText('1234567.5')).toBe('1,234,567.5')
    expect(groupAmountText('1000.')).toBe('1,000.')
    expect(groupAmountText('0.50')).toBe('0.50')
    expect(groupAmountText('999')).toBe('999')
  })
  it('reads the grouped text back as the canonical amount: its commas are thousands marks', () => {
    expect(sanitizeGroupedAmount('2,0005')).toBe('20005')
    expect(sanitizeGroupedAmount('2,000.5')).toBe('2000.5')
    expect(sanitizeGroupedAmount('1,000.')).toBe('1000.')
    expect(sanitizeGroupedAmount('١٬٢٣٤٫٥')).toBe('1234.5')
    expect(sanitizeGroupedAmount('٢٠٠٠')).toBe('2000')
    expect(sanitizeGroupedAmount('1,234.5678', 'decimal', 'KWD')).toBe('1234.567')
    expect(sanitizeGroupedAmount('12,345', 'integer')).toBe('12345')
  })
  it('round-trips: grouping then reading gives the same canonical text', () => {
    for (const v of ['', '5', '5.', '1000', '1000000.25', '0.5']) expect(sanitizeGroupedAmount(groupAmountText(v))).toBe(v)
  })
  it('keeps the caret after the same digit when a separator appears or goes', () => {
    // "2,000" with "5" typed at the end → "20,005"; caret after 5 digits.
    expect(caretInGrouped(groupAmountText('20005'), amountCharsBefore('2,0005', 6))).toBe(6)
    // A digit typed in the middle: "1,0|00" + "5" → "1,05|00" reads 10500 → "10,5|00".
    expect(caretInGrouped(groupAmountText('10500'), amountCharsBefore('1,0500', 4))).toBe(4)
    expect(caretInGrouped('1,000', 0)).toBe(0)
    expect(caretInGrouped('1,000', 9)).toBe(5)
  })
})

describe('amountInputText (W1: an edit sheet shows 85.50, not 85.5)', () => {
  it('keeps whole amounts whole and pads cents to the currency', () => {
    expect(amountInputText(245, 'EGP')).toBe('245')
    expect(amountInputText(85.5, 'EGP')).toBe('85.50')
    expect(amountInputText(1.5, 'KWD')).toBe('1.500')
    expect(amountInputText(0.0012, 'BTC')).toBe('0.0012')
  })
})
