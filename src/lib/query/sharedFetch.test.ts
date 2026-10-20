import { describe, expect, it, vi, beforeEach } from 'vitest'
import { clearSharedFetches, sharedFetch } from './sharedFetch'

describe('sharedFetch', () => {
  beforeEach(() => clearSharedFetches())

  it('shares one load between callers inside the window and reloads after it', async () => {
    const load = vi.fn(async () => 'rows')
    const [a, b] = await Promise.all([sharedFetch('k', 1000, load, 0), sharedFetch('k', 1000, load, 500)])
    expect([a, b]).toEqual(['rows', 'rows'])
    expect(load).toHaveBeenCalledTimes(1)
    await sharedFetch('k', 1000, load, 1500)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok')
    await expect(sharedFetch('f', 1000, load, 0)).rejects.toThrow('boom')
    await expect(sharedFetch('f', 1000, load, 1)).resolves.toBe('ok')
  })
})
