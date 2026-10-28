import { describe, expect, it } from 'vitest'
import { monthAfterRollover } from '@/hooks/useCycleAwareMonth'

describe('monthAfterRollover', () => {
  it('moves someone on the old current cycle to the new one', () => {
    expect(monthAfterRollover('2026-09', '2026-09', '2026-10')).toBe('2026-10')
  })
  it('leaves someone browsing history where they are', () => {
    expect(monthAfterRollover('2026-07', '2026-09', '2026-10')).toBe('2026-07')
  })
})
