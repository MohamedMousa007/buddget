import { describe, expect, it } from 'vitest'
import { CSV_BOM, escapeCsvField, withCsvBom } from './formatters'

describe('escapeCsvField', () => {
  it('quotes and doubles quotes', () => {
    expect(escapeCsvField('a "b" c')).toBe('"a ""b"" c"')
    expect(escapeCsvField(null)).toBe('""')
  })

  it.each(['=1+1', '+cmd|x', '-2+3', '@SUM(A1)', '\tx', '\rx', '=HYPERLINK("http://e","x")'])('neutralises the formula trigger in %j', (v) => {
    expect(escapeCsvField(v)).toMatch(/^"'/)
  })

  it('keeps real numbers, including negatives, unprefixed', () => {
    expect(escapeCsvField(-12.5)).toBe('"-12.5"')
    expect(escapeCsvField('-12.5')).toBe('"-12.5"')
    expect(escapeCsvField(40)).toBe('"40"')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('Groceries = fun')).toBe('"Groceries = fun"')
  })
})

describe('withCsvBom', () => {
  it('prefixes the BOM once', () => {
    expect(withCsvBom('a')).toBe(`${CSV_BOM}a`)
    expect(withCsvBom(`${CSV_BOM}a`)).toBe(`${CSV_BOM}a`)
  })
})
