import { describe, expect, it } from 'vitest'
import { membershipCopy } from './membershipCopy'

const BAD = ['free trial', 'web', 'website', 'cheaper', 'checkout', 'refund', 'تجربة مجانية', 'الموقع', 'plus', 'partner sharing']
const flat = (v: unknown): string =>
  typeof v === 'function' ? flat((v as (...a: never[]) => unknown)(...([1, 2, 3] as never[]))) : Array.isArray(v) ? v.map(flat).join(' ') : v && typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v)

describe('membership copy', () => {
  it.each(['en', 'ar'] as const)('%s: no banned billing word, no scarcity or loss copy', (l) => {
    const text = flat(membershipCopy[l]).toLowerCase()
    for (const bad of BAD) expect(text, bad).not.toContain(bad)
    expect(text).not.toMatch(/only \d+ left|left!|hurry|expires in|last chance/)
  })
  it('both languages carry the same shape', () => {
    const keys = (o: unknown, p = ''): string[] => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p])
    expect(keys(membershipCopy.ar)).toEqual(keys(membershipCopy.en))
  })
  it.each(['en', 'ar'] as const)('%s: the SMS row never prints a count of 0 or 1', (l) => {
    for (const n of [0, 1]) expect(membershipCopy[l].state.includedRows.sms(n)).not.toMatch(/\d/)
    expect(membershipCopy[l].state.includedRows.sms(4)).toContain('4')
  })
  it('the 30 days are named exactly as the board says', () => {
    expect(membershipCopy.en.hub.trialLine).toBe('30 days of Pro, no card')
  })
})
