import { describe, it, expect, vi, beforeEach } from 'vitest'

const reserve = vi.fn()
const settle = vi.fn()
vi.mock('@/lib/server/ai/quota', () => ({ reserveAiQuota: (a: unknown) => reserve(a), settleAiQuota: (...a: unknown[]) => settle(...a) }))

import { withSmsAiQuota } from './meteredAi'

beforeEach(() => { reserve.mockReset(); settle.mockReset() })

describe('withSmsAiQuota', () => {
  it('returns denied without running the call', async () => {
    reserve.mockResolvedValue({ allowed: false })
    const fn = vi.fn()
    expect(await withSmsAiQuota('u', 100, 'm', fn)).toEqual({ denied: true })
    expect(fn).not.toHaveBeenCalled()
  })
  it('settles ok on success', async () => {
    reserve.mockResolvedValue({ allowed: true })
    expect(await withSmsAiQuota('u', 100, 'm', async () => 7)).toEqual({ denied: false, value: 7 })
    expect(settle.mock.calls[0][1].status).toBe('ok')
  })
  it('settles error and rethrows on failure', async () => {
    reserve.mockResolvedValue({ allowed: true })
    await expect(withSmsAiQuota('u', 100, 'm', async () => { throw new Error('x') })).rejects.toThrow('x')
    expect(settle.mock.calls[0][1].status).toBe('error')
  })
})
