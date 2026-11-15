import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n', () => ({ useLocale: () => 'en' }))

import { buddgyChatCopy } from './buddgyChatCopy'

describe('chat quota copy', () => {
  it('names spent Sparks and the refill date instead of a time window, in both languages', () => {
    const e = { kind: 'quota', layer: 'sparks', resetAt: '2026-12-01T00:00:00Z' } as const
    expect(buddgyChatCopy.en.error(e)).toContain('Sparks')
    expect(buddgyChatCopy.en.error(e)).not.toContain('around')
    expect(buddgyChatCopy.ar.error(e)).toContain('شرارات')
  })
})
