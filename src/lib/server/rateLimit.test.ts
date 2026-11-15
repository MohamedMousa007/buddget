import { describe, expect, it, vi } from 'vitest'
import { isRateLimited, rateLimitOutcome } from './rateLimit'

const svc = (res: { data: unknown; error: unknown }) => ({ rpc: vi.fn().mockResolvedValue(res) }) as never

describe('isRateLimited', () => {
  it('allows when the counter says yes', async () => {
    expect(await isRateLimited(svc({ data: true, error: null }), 'k', 60, 5)).toBe(false)
  })
  it('blocks when the counter says no', async () => {
    expect(await isRateLimited(svc({ data: false, error: null }), 'k', 60, 5)).toBe(true)
  })
  it('fails closed when the rpc errors', async () => {
    expect(await isRateLimited(svc({ data: null, error: { message: 'down' } }), 'k', 60, 5)).toBe(true)
  })
})

describe('rateLimitOutcome', () => {
  it('tells a counter outage from a real limit', async () => {
    expect(await rateLimitOutcome(svc({ data: true, error: null }), 'k', 60, 5)).toBe('ok')
    expect(await rateLimitOutcome(svc({ data: false, error: null }), 'k', 60, 5)).toBe('limited')
    expect(await rateLimitOutcome(svc({ data: null, error: { message: 'down' } }), 'k', 60, 5)).toBe('error')
  })
})
