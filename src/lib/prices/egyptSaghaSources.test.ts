import { describe, it, expect } from 'vitest'
import {
  parseArabicNumber,
  numberAfter,
  EGYPT_SAGHA_SOURCES,
} from './egyptSaghaSources'

describe('parseArabicNumber', () => {
  it('parses ASCII, commas and Arabic-Indic digits', () => {
    expect(parseArabicNumber('52.41')).toBe(52.41)
    expect(parseArabicNumber('5,960')).toBe(5960)
    expect(parseArabicNumber('٥٢٫٤')).toBe(52) // Arabic-Indic 52 (decimal comma differs)
    expect(parseArabicNumber('١٢٣')).toBe(123)
    expect(parseArabicNumber('no number')).toBeNull()
  })
})

describe('numberAfter', () => {
  it('grabs the first number after an anchor', () => {
    expect(numberAfter('foo متوسط السعر 52.41 bar', 'متوسط السعر')).toBe(52.41)
    expect(numberAfter('عيار 21 5,960 جنيه', 'عيار 21')).toBe(5960)
  })
  it('returns null when the anchor is absent', () => {
    expect(numberAfter('nothing here', 'متوسط السعر')).toBeNull()
  })
})

// Snippets mirroring the real server-rendered HTML (verified live 2026-07-25).
const REALEGP = '<div>سعر دولار الصاغة مقابل الجنيه الآن <b>متوسط السعر <span>52.41</span></b> السعر يتراوح</div>'
const SOUQ = '<li>دولار الصاغة <strong>52.46</strong> جنيه</li><li>ذهب عيار 21 5980 جنيه</li>'
const DOLLAREGYPT = '<td>عيار 21</td><td>5,960</td><td>0.00%</td>'
// A JS-rendered page: the price is a placeholder in raw HTML.
const JS_RENDERED = '<span class="price">عيار 21 <b>00.00</b></span>'

describe('EGYPT_SAGHA_SOURCES extractors on realistic HTML', () => {
  const ctx = { ounceUsd: 4063.5 }
  const byId = Object.fromEntries(EGYPT_SAGHA_SOURCES.map((s) => [s.id, s]))

  it('realegp reads the Sagha dollar directly', () => {
    expect(byId['realegp'].extract(REALEGP, ctx)).toBeCloseTo(52.41, 2)
  })
  it('souq reads the Sagha dollar directly', () => {
    expect(byId['souq-price-today'].extract(SOUQ, ctx)).toBeCloseTo(52.46, 2)
  })
  it('dollaregypt back-calcs the scalar from the 21k price (≈ the direct sources)', () => {
    const sagha = byId['dollaregypt'].extract(DOLLAREGYPT, ctx)!
    expect(sagha).toBeGreaterThan(51)
    expect(sagha).toBeLessThan(54)
  })
  it('a JS-rendered placeholder yields a junk/zero value the sanity band will drop', () => {
    // "00.00" parses to 0 for a direct source (dropped as <=0); via karat it back-calcs to 0.
    const s = byId['dollaregypt'].extract(JS_RENDERED, ctx)
    expect(s === null || s <= 0.01).toBe(true)
  })
})
