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

describe('floating Buddgy button label (QA-64)', () => {
  it('names Buddgy, not the budget setup, in both languages', async () => {
    const { en } = await import('./dictionaries/en')
    const { ar } = await import('./dictionaries/ar')
    expect(en.modals.fabAskAi).toContain('Buddgy')
    expect(ar.modals.fabAskAi).toContain('Buddgy')
  })
})
