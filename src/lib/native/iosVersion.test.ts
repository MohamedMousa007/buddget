import { describe, expect, it } from 'vitest'
import { guideVariantFor, parseIosMajor } from './iosVersion'

describe('iOS version', () => {
  it('reads the major version', () => {
    expect(parseIosMajor('27.1.2')).toBe(27)
    expect(parseIosMajor('16.4')).toBe(16)
    expect(parseIosMajor('')).toBeNull()
    expect(parseIosMajor(null)).toBeNull()
    expect(parseIosMajor('beta')).toBeNull()
  })
  it('iOS 27 and later get the shared shortcut; older or unknown get the manual guide', () => {
    expect(guideVariantFor(27)).toBe('shortcut')
    expect(guideVariantFor(28)).toBe('shortcut')
    expect(guideVariantFor(26)).toBe('manual')
    expect(guideVariantFor(null)).toBe('manual')
  })
})
