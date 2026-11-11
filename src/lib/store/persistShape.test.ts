import { describe, expect, it } from 'vitest'
import { dropMistypedFields } from '@/lib/store/persistShape'

const defaults = { expenses: [] as unknown[], goals: [] as unknown[], profile: { id: 'local' }, exchangeRates: {} as Record<string, number>, flag: true, active: null as string | null }

describe('OFS-9 dropMistypedFields', () => {
  it.each([
    ['expenses null', { expenses: null }],
    ['goals string', { goals: 'x' }],
    ['profile null', { profile: null }],
    ['rates array', { exchangeRates: [] }],
  ])('%s falls back to the default', (_n, bad) => {
    const out = dropMistypedFields(bad as never, defaults) as Record<string, unknown>
    for (const k of Object.keys(bad)) expect(k in out).toBe(false)
  })
  it('keeps valid fields and scalars untouched', () => {
    const p = { expenses: [1], profile: { id: 'u' }, flag: false, active: 'a' }
    expect(dropMistypedFields(p as never, defaults)).toEqual(p)
  })
})
