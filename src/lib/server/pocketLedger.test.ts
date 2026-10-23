import { describe, expect, it } from 'vitest'
import { groupIdFor } from './pocketLedger'

describe('groupIdFor', () => {
  it('is a stable uuid-shaped token per key and differs across keys', () => {
    const a = groupIdFor('goal-1|2026-09')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(groupIdFor('goal-1|2026-09')).toBe(a)
    expect(groupIdFor('goal-1|2026-10')).not.toBe(a)
  })
})
