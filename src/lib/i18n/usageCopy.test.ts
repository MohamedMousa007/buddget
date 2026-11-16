import { describe, expect, it } from 'vitest'
import { usageCopy } from './usageCopy'

const BAD = ['free trial', 'web', 'website', 'cheaper', 'checkout', 'refund', 'تجربة مجانية', 'الموقع', 'subscription']
const SAMPLE = { time: '18:40', day: 'Saturday', date: '1 Dec', n: 2, sparks: 12 }
const flat = (v: unknown): string =>
  typeof v === 'function' ? flat((v as (...a: unknown[]) => unknown)(SAMPLE, 'x')) : Array.isArray(v) ? v.map(flat).join(' ') : v && typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v)

describe('usage copy', () => {
  it.each(['en', 'ar'] as const)('%s: no banned billing word, no scarcity or loss copy, no countdown', (l) => {
    const text = flat(usageCopy[l]).toLowerCase()
    for (const bad of BAD) expect(text, bad).not.toContain(bad)
    expect(text).not.toMatch(/only \d+ left|hurry|last chance|you'll lose|you’ll lose|expires in|countdown/)
  })
  it('both languages carry the same keys, and every notice has a title', () => {
    const keys = (o: unknown, p = ''): string[] => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p])
    expect(keys(usageCopy.ar)).toEqual(keys(usageCopy.en))
    for (const l of ['en', 'ar'] as const) for (const e of Object.values(usageCopy[l].notices)) expect(e.title(SAMPLE).length).toBeGreaterThan(3)
  })
  it('percentages only: credits never appear in the copy', () => {
    expect(flat(usageCopy.en).toLowerCase()).not.toContain('credit')
  })
})
