import { describe, expect, it, vi } from 'vitest'
import { isSafeRegexPattern, MAX_REGEX_PATTERN_CHARS } from '@/lib/sms/safeRegex'

describe('isSafeRegexPattern', () => {
  it.each(['(a+)+$', '(\\d*)*x', '(?:a|b+)*c', '((a+)b)+', '(x+){2,}', '(.+)*'])('rejects nested quantifier %s', (p) => {
    expect(isSafeRegexPattern(p)).toBe(false)
  })

  it.each([
    'EGP\\s*([\\d,]+(?:\\.\\d{2})?)\\s+at\\s+(.+?)\\s+on',
    '(\\d+(?:,\\d{3})*)\\s',
    '[+*]+(a)',
    '\\(a+\\)+',
    '(a{1,3})+',
    '(?:ending|ends)\\s+(\\d{4})',
  ])('accepts %s', (p) => {
    expect(isSafeRegexPattern(p)).toBe(true)
  })

  it('rejects overlong patterns', () => {
    expect(isSafeRegexPattern('a'.repeat(MAX_REGEX_PATTERN_CHARS + 1))).toBe(false)
  })
})

describe('applyMappingRules skip logging', () => {
  it('warns when an unsafe template is skipped', async () => {
    const { applyMappingRules } = await import('./templateApply')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = applyMappingRules('aaaa', '(a+)+b', { amount: { group: 1 }, kind: 'purchase' } as never)
    expect(out).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
