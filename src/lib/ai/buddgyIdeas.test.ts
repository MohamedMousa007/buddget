import { describe, it, expect } from 'vitest'
import { en } from '@/lib/i18n/dictionaries/en'
import { buddgyIdeas, buddgyNudge, nudgeAllowed, moodForReply, screenFromPath, type BuddgyIdeaContext } from '@/lib/ai/buddgyIdeas'

const base: BuddgyIdeaContext = {
  screen: 'dashboard', paceStatus: 'on_track', overBudgetCategories: [],
  hasBudget: true, hasDebts: false, hasGoals: false, hasSpending: true, dailyAllowance: 'AED 120',
}
const t = en.buddgy

describe('buddgyIdeas', () => {
  it('leads with a live problem, caps at four, never repeats', () => {
    const ideas = buddgyIdeas({ ...base, paceStatus: 'over', overBudgetCategories: [{ category: 'Food', spent: 1200, cap: 1000, overBy: 200 }] }, t)
    expect(ideas[0].id).toBe('over')
    expect(ideas.length).toBeLessThanOrEqual(4)
    expect(new Set(ideas.map((i) => i.id)).size).toBe(ideas.length)
  })
  it('skips questions the data cannot answer', () => {
    const ids = buddgyIdeas({ ...base, screen: 'debts' }, t).map((i) => i.id)
    expect(ids).not.toContain('debt')
  })
})

describe('buddgyNudge', () => {
  it('flags overspend on money screens with the real percentage', () => {
    const n = buddgyNudge({ ...base, overBudgetCategories: [{ category: 'Food', spent: 1500, cap: 1000, overBy: 500 }] }, t)
    expect(n?.mood).toBe('worried')
    expect(n?.text).toContain('50%')
  })
  it('stays quiet on screens with nothing relevant', () => {
    expect(buddgyNudge({ ...base, screen: 'other' }, t)).toBeNull()
  })
})

describe('nudgeAllowed', () => {
  const noon = new Date(2026, 8, 29, 12, 0)
  const log = { day: noon.toDateString(), count: 1, lastAt: noon.getTime() - 60_000, seen: ['x'] }
  it('enforces gap, cap, repeats and quiet hours', () => {
    expect(nudgeAllowed(log, 'y', noon)).toBe(false) // 1 min since last
    expect(nudgeAllowed({ ...log, lastAt: 0 }, 'y', noon)).toBe(true)
    expect(nudgeAllowed({ ...log, lastAt: 0 }, 'x', noon)).toBe(false)
    expect(nudgeAllowed({ ...log, lastAt: 0, count: 3 }, 'y', noon)).toBe(false)
    expect(nudgeAllowed({ ...log, lastAt: 0 }, 'y', new Date(2026, 8, 29, 23, 30))).toBe(false)
    expect(nudgeAllowed(log, 'x', new Date(2026, 8, 30, 12, 0))).toBe(true) // new day resets
  })
})

it('maps reply mood with a shape-based fallback', () => {
  expect(moodForReply({ mood: 'worried', clarificationNeeded: null, actions: [] })).toBe('worried')
  expect(moodForReply({ clarificationNeeded: 'which card?', actions: [] })).toBe('curious')
  expect(moodForReply({ clarificationNeeded: null, actions: [{ action: 'add_expense' }] })).toBe('happy')
  expect(screenFromPath('/wealth/x')).toBe('savings')
})
