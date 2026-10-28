import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))

import { memoryRateLimitOk, publicApiRateLimitOk, resetMemoryRateLimit } from '@/lib/server/publicApiRateLimit'

describe('memoryRateLimitOk', () => {
  it('allows 240 hits per minute then blocks, and recovers after the window', () => {
    const t = 1_000_000
    for (let i = 0; i < 240; i++) expect(memoryRateLimitOk('1.1.1.1', t)).toBe(true)
    expect(memoryRateLimitOk('1.1.1.1', t)).toBe(false)
    expect(memoryRateLimitOk('1.1.1.1', t + 61_000)).toBe(true)
  })
})

describe('publicApiRateLimitOk', () => {
  beforeEach(() => {
    rpc.mockReset()
    resetMemoryRateLimit()
  })

  it('never touches the DB below 50% of the in-memory allowance', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    for (let i = 0; i < 120; i++) expect(await publicApiRateLimitOk('2.2.2.2')).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('consults the shared limiter once past 50% and honours its verdict', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    for (let i = 0; i < 120; i++) await publicApiRateLimitOk('3.3.3.3')
    expect(await publicApiRateLimitOk('3.3.3.3')).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('falls back to in-memory when the RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    for (let i = 0; i < 121; i++) expect(await publicApiRateLimitOk('4.4.4.4')).toBe(true)
    expect(rpc).toHaveBeenCalled()
  })

  it('blocks in-memory past the hard cap without the DB', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    for (let i = 0; i < 240; i++) await publicApiRateLimitOk('5.5.5.5')
    expect(await publicApiRateLimitOk('5.5.5.5')).toBe(false)
  })
})
