import { describe, expect, it, vi } from 'vitest'
import { isSafeRegexPattern, MAX_REGEX_PATTERN_CHARS, squeezeWhitespace } from '@/lib/sms/safeRegex'

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

  it.each([
    String.raw`\d+\d+\d+x`,
    String.raw`[\d,]+[\d,.]+\d+\s?EGP`,
    String.raw`(\d+)(\d+)(\d+)x`,
    String.raw`\w+\w*[a-z0-9]+!`,
    String.raw`.*?a.*?b.*?c`,
  ])('rejects overlapping unbounded atoms in a row %s', (p) => {
    expect(isSafeRegexPattern(p)).toBe(false)
  })

  it.each([
    String.raw`Transaction\s+(EGP)\s+([\d,]+\.?\d*)\s+on\s+Card\s+ending\s+[\d*\-]+\s+([\d*\-]+)\s+was\s+declined`,
    String.raw`From\s+HSBC:\s+(\d{2}[A-Z]{3}\d{2})\s+(.+?)\s+Purchase\s+from\s+[\d*\-]+\s+EGP\s+([\d,]+\.?\d*)-\s+Your\s+available\s+balance\s+is\s+EGP\s+[\d,]+\.?\d*`,
    String.raw`Local\s+Purchase\s+Card:\s+([\d*\-]+);\s+Mada\s+Amount:\s+([\d,]+\.?\d*)\s+SAR\s+At:\s+(.+?)\s+Date:\s+(\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2})`,
    String.raw`تم\s+سداد\s+مبلغ\s+([\d,]+\.?\d*)\s+جم\s+فى\s+بطاقتكم\s+الائتمانية\s+المنتهية\s+بـ\s+([\d*\-]+)\s+بتاريخ\s+(\S+)`,
    String.raw`Your\s+Debit\s+Card\s+([\d*]+)\s+had\s+a\s+Successful\s+transaction\s+of\s+EGP\s+([\d,]+\.?\d*)\s+@(.+?),your\s+available\s+bal\.EGP\d+\.?\d*\s+for\s+lost/stolen\s+card\s+call\s+\d+`,
    String.raw`تم\s+شحن\s+رصيد\s+موبايلك\s+ب\s+\S+\s+بنجاح\s+وخصم\s+([\d,]+\.?\d*)\s+من\s+محفظتك\s+رصيد\s+حسابك\s+الحالي\s+\S+\.\d*\.\s+تابع`,
  ])('still accepts a real-shaped template', (p) => {
    expect(isSafeRegexPattern(p)).toBe(true)
  })

  it('answers the same for a repeated pattern', () => {
    const p = String.raw`\d+\d+\d+x`
    expect([isSafeRegexPattern(p), isSafeRegexPattern(p)]).toEqual([false, false])
  })
})

describe('whitespace padding', () => {
  it('squeezes a run of eight or more, keeping a line break', () => {
    expect(squeezeWhitespace(`a${' '.repeat(40)}b`)).toBe('a b')
    expect(squeezeWhitespace(`a${' '.repeat(10)}\n${' '.repeat(10)}b`)).toBe('a\nb')
    expect(squeezeWhitespace('a   b')).toBe('a   b')
  })

  it('applies a common template to a whitespace-padded message without stalling', async () => {
    const { applyMappingRules } = await import('./templateApply')
    const pattern = String.raw`Paid\s+(.+?)\s+EGP\s+([\d,]+\.?\d*)`
    const message = `Paid${' '.repeat(900)}zzz`
    const started = Date.now()
    expect(applyMappingRules(message, pattern, { amount: { group: 2 } } as never)).toBeNull()
    expect(Date.now() - started).toBeLessThan(500)
  })
})

describe('applyMappingRules skip logging', () => {
  it('warns when an unsafe template is skipped', async () => {
    const { applyMappingRules } = await import('./templateApply')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = applyMappingRules('aaaa', '(a+)+b', { amount: { group: 1 } } as never)
    expect(out).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
