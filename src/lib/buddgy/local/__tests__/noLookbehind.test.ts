import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractDate } from '../quickAddDate'
import { matchCategories } from '../lexicon'
import { classifyIntent } from '../classifyIntent'
import { stripAll, wordRe } from '../text'

const FILES = ['quickAddDate.ts', 'lexicon.ts', 'text.ts', 'parseQuickAdd.ts']

describe('iOS 16.0-16.3 safe regexes (no lookbehind)', () => {
  it.each(FILES)('%s has no lookbehind', (file) => {
    const src = readFileSync(join(__dirname, '..', file), 'utf8')
    expect(src).not.toMatch(/\(\?<[!=]/)
  })

  it('wordRe keeps whole-word semantics and stripAll keeps the separator', () => {
    const re = wordRe('today|اليوم')
    expect(re.test('spent today')).toBe(true)
    expect(re.test('todays')).toBe(false)
    expect(re.test('xtoday')).toBe(false)
    expect(stripAll('a today b', re)).toBe('a   b')
    expect(stripAll('today today', re).trim()).toBe('')
  })

  it('extractDate handles ISO and slash dates without eating neighbours', () => {
    expect(extractDate('lunch 2026-10-01 150', '2026-10-28')).toEqual({ date: '2026-10-01', rest: 'lunch   150' })
    expect(extractDate('lunch 5/10 150', '2026-10-28')?.date).toBe('2026-10-05')
    expect(extractDate('x12026-10-01', '2026-10-28')?.date).toBeUndefined()
    expect(extractDate('2026-10-01', '2026-10-28')?.date).toBe('2026-10-01')
  })

  it('lexicon arabic prefix and boundary', () => {
    expect(matchCategories('اشتريت ملابس')).toContain('Shopping')
    expect(matchCategories('بالملابس')).toContain('Shopping')
  })

  it('classifyIntent start-of-text still index-anchored', () => {
    expect(classifyIntent('spent 50 on lunch')).toBe('action')
    expect(classifyIntent('how much did I spend')).toBe('answer')
  })
})
