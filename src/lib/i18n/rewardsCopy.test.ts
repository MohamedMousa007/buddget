import { describe, expect, it } from 'vitest'
import { rewardsCopy } from './rewardsCopy'

const flat = (v: unknown): string =>
  typeof v === 'function' ? flat((v as (...a: never[]) => unknown)(...([3, 2, 1] as never[]))) : Array.isArray(v) ? v.map(flat).join(' ') : v && typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v)
const keys = (o: unknown, p = ''): string[] => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p])

describe('rewards copy', () => {
  it('both languages carry the same shape', () => {
    expect(keys(rewardsCopy.ar)).toEqual(keys(rewardsCopy.en))
  })
  it.each(['en', 'ar'] as const)('%s: lowercase buddget, no em dash, no scarcity or loss copy', (l) => {
    const text = flat(rewardsCopy[l])
    expect(text).not.toContain('—')
    expect(text).not.toMatch(/Buddget\b/)
    expect(text.toLowerCase()).not.toMatch(/only \d+ left|hurry|last chance|expires in|you’ll lose/)
  })
  it('the real earn rule is named, not the mockup placeholders', () => {
    expect(rewardsCopy.en.rewards.earn.weekHint).toBe('x1.5 from week 4, x2 from week 8')
  })
  it('the invite reward is worded both ways', () => {
    expect(rewardsCopy.en.invite.heroSub(rewardsCopy.en.invite.rewardWeek)).toContain('a week of Pro')
    expect(rewardsCopy.en.invite.steps(rewardsCopy.en.invite.rewardSparks)[2]).toContain('500 Sparks')
  })
  it('Arabic writes Pro, Sparks and buddget in Arabic letters', () => {
    const ar = flat(rewardsCopy.ar)
    for (const word of ['برو', 'سبارك', 'بادجت']) expect(ar).toContain(word)
    expect(ar).not.toMatch(/\b(buddget|Buddgy|Pro|Sparks?)\b/)
  })
})
