import { describe, it, expect } from 'vitest'
import { parseLocalizedAmount, currencyDecimals, canonicalAmount } from './amountParse'
import { sanitizeAmount } from './amountSanitize'

describe('parseLocalizedAmount', () => {
  it('treats the last separator as the decimal mark', () => {
    expect(parseLocalizedAmount('1,250.50')).toBe(1250.5)
    expect(parseLocalizedAmount('1.250,50')).toBe(1250.5)
    expect(parseLocalizedAmount('1 250,5')).toBe(1250.5)
  })
  it('lone comma + 3 digits is thousands, otherwise decimal', () => {
    expect(parseLocalizedAmount('1,250')).toBe(1250)
    expect(parseLocalizedAmount('1,25')).toBe(1.25)
    expect(parseLocalizedAmount('0,250', 'KWD')).toBe(0.25)
    expect(parseLocalizedAmount('1,250,000')).toBe(1250000)
    expect(parseLocalizedAmount('1.5')).toBe(1.5)
  })
  it('keeps 3 decimals for KWD/BHD/OMR/JOD/TND and caps others at 2', () => {
    expect(parseLocalizedAmount('12.345', 'KWD')).toBe(12.345)
    expect(parseLocalizedAmount('12.345', 'USD')).toBe(12.35)
    ;(['KWD', 'BHD', 'OMR', 'JOD', 'TND'] as const).forEach((c) => expect(currencyDecimals(c)).toBe(3))
  })
  it('reads Arabic-Indic digits and separators', () => {
    expect(parseLocalizedAmount('١٢٣٫٤٥')).toBe(123.45)
    expect(parseLocalizedAmount('١٬٢٥٠٫٥')).toBe(1250.5)
    expect(parseLocalizedAmount('۱۲,۵')).toBe(12.5)
  })
  it('is NaN without digits', () => {
    expect(parseLocalizedAmount('abc')).toBeNaN()
  })
})

describe('sanitizeAmount with currency', () => {
  it('pasted grouped amounts survive', () => {
    expect(sanitizeAmount('1,250')).toBe('1250')
    expect(sanitizeAmount('1,250.50')).toBe('1250.50')
  })
  it('allows 3 decimals only for 3-dp currencies', () => {
    expect(sanitizeAmount('1.2345', 'decimal', 'KWD')).toBe('1.234')
    expect(sanitizeAmount('1.2345', 'decimal', 'EGP')).toBe('1.23')
  })
  it('keeps typing states', () => {
    expect(sanitizeAmount('5.')).toBe('5.')
    expect(sanitizeAmount('٥')).toBe('5')
  })
})

describe('review B2 parser cases', () => {
  it('F1: a second separator never merges digits while typing', () => {
    expect(canonicalAmount('1.25.')).toBe('1.25')
    expect(canonicalAmount('1.25,')).toBe('1.25')
    expect(canonicalAmount('1.5.5')).toBe('1.5')
    expect(canonicalAmount('1,25,3')).toBe('1.25')
    expect(canonicalAmount('5.')).toBe('5.')
  })
  it('F1: pasted malformed repeats are rejected by the parser', () => {
    expect(parseLocalizedAmount('1.5.5')).toBeNaN()
    expect(parseLocalizedAmount('1,25,3')).toBeNaN()
    expect(parseLocalizedAmount('1,250,000')).toBe(1250000)
    expect(parseLocalizedAmount('1.250.000')).toBe(1250000)
  })
  it('F2: lone comma + 3 digits is a decimal mark for 3-decimal and crypto currencies', () => {
    expect(parseLocalizedAmount('1,250', 'KWD')).toBe(1.25)
    expect(parseLocalizedAmount('1,250', 'BHD')).toBe(1.25)
    expect(parseLocalizedAmount('1,234', 'BTC')).toBe(1.234)
    expect(parseLocalizedAmount('1,250', 'USD')).toBe(1250)
    expect(parseLocalizedAmount('1,250')).toBe(1250)
    expect(canonicalAmount('1,250', 3)).toBe('1.250')
  })
  it('F3: rounds instead of truncating, rejects exponents, drops a sign consistently', () => {
    expect(parseLocalizedAmount('1.259')).toBe(1.26)
    expect(parseLocalizedAmount('1.250')).toBe(1.25)
    expect(parseLocalizedAmount('1e3')).toBeNaN()
    expect(canonicalAmount('1e3')).toBe('')
    expect(parseLocalizedAmount('-3,50')).toBe(3.5)
  })
})
