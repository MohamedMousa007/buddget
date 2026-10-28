import { describe, expect, it } from 'vitest'
import { bannerText, computeCountdown, normaliseCoverage, packToCsv, parseKeepDays, share, validateReview } from './patternReview'

const now = new Date('2026-10-28T00:00:00Z')

describe('parseKeepDays', () => {
  it('treats missing, zero and junk as off', () => {
    expect(parseKeepDays(undefined)).toBeNull()
    expect(parseKeepDays(0)).toBeNull()
    expect(parseKeepDays('x')).toBeNull()
    expect(parseKeepDays(30)).toBe(30)
    expect(parseKeepDays('30')).toBe(30)
  })
})

describe('computeCountdown', () => {
  it('is off when retention is off', () => expect(computeCountdown(null, '2026-10-01T00:00:00Z', now)).toEqual({ state: 'off' }))
  it('is empty with no raw bodies', () => expect(computeCountdown(30, null, now).state).toBe('empty'))
  it('counts days to the oldest body reaching the window', () => {
    const c = computeCountdown(30, '2026-10-05T00:00:00Z', now)
    expect(c).toMatchObject({ state: 'ok', daysLeft: 7, due: true })
  })
  it('is not due beyond 7 days and never negative', () => {
    expect(computeCountdown(30, '2026-10-27T00:00:00Z', now)).toMatchObject({ daysLeft: 29, due: false })
    expect(computeCountdown(30, '2026-01-01T00:00:00Z', now)).toMatchObject({ daysLeft: 0, due: true })
  })
})

describe('bannerText', () => {
  it('pluralises', () => {
    expect(bannerText(3)).toBe('3 days to purge. Analyse before masking')
    expect(bannerText(1)).toBe('1 day to purge. Analyse before masking')
    expect(bannerText(0)).toContain('due today')
  })
})

describe('validateReview', () => {
  it('allows reviewed without notes and trims', () => expect(validateReview('mark_reviewed', '  ok ', undefined)).toEqual({ ok: true, status: 'reviewed', notes: 'ok' }))
  it('requires a reason to skip', () => {
    expect(validateReview('skip', undefined, '  ').ok).toBe(false)
    expect(validateReview('skip', undefined, 'no time')).toEqual({ ok: true, status: 'skipped', notes: 'no time' })
  })
  it('rejects unknown ops', () => expect(validateReview('nuke', '', '').ok).toBe(false))
})

describe('packToCsv', () => {
  it('escapes quotes, commas and formula injection', () => {
    expect(packToCsv([{ a: 'x,y', b: '=cmd' }, { a: 'q"', c: { k: 1 } }])).toBe('a,b,c\n"x,y",\'=cmd,\n"q""",,"{""k"":1}"')
  })
  it('is empty for no rows', () => expect(packToCsv([])).toBe(''))
})

describe('coverage', () => {
  it('normalises and sorts by volume, tolerating junk', () => {
    expect(normaliseCoverage(null)).toEqual([])
    const rows = normaliseCoverage([{ bank: 'A', total: 5 }, { sender_key: 'B', total: '9', ai: 3, top_unlearned: ['s'] }])
    expect(rows.map((r) => r.bank)).toEqual(['B', 'A'])
    expect(rows[0]).toMatchObject({ total: 9, ai: 3, top_unlearned: ['s'] })
  })
  it('share is zero-safe', () => expect(share(1, 0)).toBe(0))
})

import { readFileSync } from 'fs'
import { PATTERN_REVIEW_PROMPT } from './patternReviewPrompt'

describe('review prompt', () => {
  it('matches docs/sms-pattern-review-prompt.md', () => {
    expect(PATTERN_REVIEW_PROMPT).toBe(readFileSync('docs/sms-pattern-review-prompt.md', 'utf8').trim())
  })
})
