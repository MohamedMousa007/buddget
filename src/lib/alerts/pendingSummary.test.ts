import { describe, it, expect } from 'vitest'
import { pendingCopy, pendingKinds, type PendingLabels } from '@/lib/alerts/pendingSummary'

const labels: PendingLabels = {
  mixedTitle: (n) => `${n} things need you`,
  label: (k, n) => (k === 'heldMessages' ? `${n} bank messages` : `${n} expenses on no account`),
  hint: (k) => (k === 'heldMessages' ? 'Not counted until you confirm' : 'Place them'),
  more: (n) => `${n} more`,
}

describe('pendingKinds', () => {
  it('drops empty kinds, merges duplicates and keeps the naming order', () => {
    expect(
      pendingKinds([
        { kind: 'unplacedExpenses', count: 2 },
        { kind: 'heldMessages', count: 0 },
        { kind: 'unplacedExpenses', count: 1 },
        { kind: 'heldMessages', count: 5 },
      ]),
    ).toEqual([
      { kind: 'heldMessages', count: 5 },
      { kind: 'unplacedExpenses', count: 3 },
    ])
  })
  it('nothing waiting is an empty list', () => {
    expect(pendingKinds([{ kind: 'heldMessages', count: 0 }])).toEqual([])
  })
})

describe('pendingCopy', () => {
  it('is null when nothing waits', () => {
    expect(pendingCopy([], labels)).toBeNull()
    expect(pendingCopy([{ kind: 'heldMessages', count: 0 }], labels)).toBeNull()
  })
  it('one kind says what it is and what it needs', () => {
    expect(pendingCopy([{ kind: 'heldMessages', count: 5 }], labels)).toEqual({
      mode: 'single',
      entry: { kind: 'heldMessages', count: 5 },
      title: '5 bank messages',
      subtitle: 'Not counted until you confirm',
    })
  })
  it('two kinds: the title counts kinds, the subtitle names each with its own count', () => {
    const c = pendingCopy([{ kind: 'unplacedExpenses', count: 2 }, { kind: 'heldMessages', count: 5 }], labels)
    expect(c).toMatchObject({ mode: 'mixed', title: '2 things need you', subtitle: '5 bank messages · 2 expenses on no account' })
  })
  it('names at most the first kinds, then "N more", while a screen reader hears all of them', () => {
    const c = pendingCopy([{ kind: 'heldMessages', count: 5 }, { kind: 'unplacedExpenses', count: 2 }], labels, 1)
    expect(c).toMatchObject({ mode: 'mixed', title: '2 things need you', subtitle: '5 bank messages · 1 more' })
    expect(c && c.mode === 'mixed' ? c.spoken : '').toBe('2 things need you: 5 bank messages, 2 expenses on no account')
  })
})

import { pendingSeverity } from '@/lib/alerts/pendingSummary'

describe('pendingSeverity (the avatar dot)', () => {
  const now = Date.parse('2026-11-20T12:00:00Z')
  const day = 86_400_000
  it('is none when nothing waits', () => {
    expect(pendingSeverity([], now)).toBe('none')
    expect(pendingSeverity([{ kind: 'heldMessages', count: 0 }], now)).toBe('none')
  })
  it('is amber while something waits, including when its age is unknown', () => {
    expect(pendingSeverity([{ kind: 'heldMessages', count: 2, since: now - 2 * day }], now)).toBe('amber')
    expect(pendingSeverity([{ kind: 'unplacedExpenses', count: 1 }], now)).toBe('amber')
  })
  it('turns red once the oldest item has waited 7 days', () => {
    expect(pendingSeverity([{ kind: 'heldMessages', count: 2, since: now - 7 * day }], now)).toBe('red')
    expect(pendingSeverity([{ kind: 'heldMessages', count: 2, since: now - 7 * day + 1 }], now)).toBe('amber')
  })
  it('keeps the oldest when the same kind is listed twice', () => {
    expect(pendingSeverity([{ kind: 'heldMessages', count: 1, since: now - day }, { kind: 'heldMessages', count: 1, since: now - 9 * day }], now)).toBe('red')
  })
})
