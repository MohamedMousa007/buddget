import { describe, expect, it } from 'vitest'
import { memoryRateLimitOk } from '@/lib/server/publicApiRateLimit'

describe('memoryRateLimitOk', () => {
  it('allows 120 hits per minute then blocks, and recovers after the window', () => {
    const t = 1_000_000
    for (let i = 0; i < 120; i++) expect(memoryRateLimitOk('1.1.1.1', t)).toBe(true)
    expect(memoryRateLimitOk('1.1.1.1', t)).toBe(false)
    expect(memoryRateLimitOk('1.1.1.1', t + 61_000)).toBe(true)
  })
})
