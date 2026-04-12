import { describe, expect, it } from 'vitest'
import {
  buddgyAmountBlurDisplay,
  parseBuddgyAmountInput,
  sanitizeBuddgyAmountTyping,
} from '@/lib/budget/buddgyAmountInput'

describe('sanitizeBuddgyAmountTyping', () => {
  it('keeps digits and one decimal', () => {
    expect(sanitizeBuddgyAmountTyping('12.34')).toBe('12.34')
    expect(sanitizeBuddgyAmountTyping('12,34')).toBe('12.34')
  })
  it('drops letters and extra dots', () => {
    expect(sanitizeBuddgyAmountTyping('1a2b3')).toBe('123')
    expect(sanitizeBuddgyAmountTyping('1.2.3')).toBe('1.23')
  })
  it('drops minus', () => {
    expect(sanitizeBuddgyAmountTyping('-5')).toBe('5')
  })
})

describe('parseBuddgyAmountInput', () => {
  it('parses non-negative', () => {
    expect(parseBuddgyAmountInput('100')).toBe(100)
    expect(parseBuddgyAmountInput('')).toBe(0)
    expect(parseBuddgyAmountInput('.')).toBe(0)
  })
})

describe('buddgyAmountBlurDisplay', () => {
  it('empty becomes 0', () => {
    expect(buddgyAmountBlurDisplay('')).toBe('0')
    expect(buddgyAmountBlurDisplay('   ')).toBe('0')
  })
})
