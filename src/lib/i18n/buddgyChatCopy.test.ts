import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/i18n', () => ({ useLocale: () => 'en' }))

import { buddgyChatCopy } from './buddgyChatCopy'

describe('chat quota copy', () => {
  it('names spent Sparks and the refill date instead of a time window, in both languages', () => {
    const e = { kind: 'quota', layer: 'sparks', resetAt: '2026-12-01T00:00:00Z' } as const
    expect(buddgyChatCopy.en.error(e)).toContain('Sparks')
    expect(buddgyChatCopy.en.error(e)).not.toContain('around')
    expect(buddgyChatCopy.ar.error(e)).toContain('سبارك')
  })
})

// BDG-012: a weekly reset days away must name the day, and a per-minute rate block is not "come back later".
describe('chat limit copy names when it is back', () => {
  const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

  it('a reset on another day names the date, not only a clock time', () => {
    const resetAt = days(3)
    const date = new Date(resetAt).toLocaleDateString('en-GB', { day: 'numeric' })
    expect(buddgyChatCopy.en.error({ kind: 'quota', layer: 'week', resetAt })).toContain(date)
    expect(buddgyChatCopy.ar.error({ kind: 'quota', layer: 'week', resetAt }).length).toBeGreaterThan(0)
  })

  it('a rate block asks for a minute, in both languages', () => {
    const e = { kind: 'quota', layer: 'rate', resetAt: days(0) } as const
    expect(buddgyChatCopy.en.error(e)).toContain('minute')
    expect(buddgyChatCopy.en.error(e)).not.toContain('talked your ear off')
    expect(buddgyChatCopy.ar.error(e)).toContain('دقيقة')
  })
})

describe('floating Buddgy button label (QA-64)', () => {
  it('names Buddgy, not the budget setup, in both languages', async () => {
    const { en } = await import('./dictionaries/en')
    const { ar } = await import('./dictionaries/ar')
    expect(en.modals.fabAskAi).toContain('Buddgy')
    expect(ar.modals.fabAskAi).toContain('بادجي')
  })
})
