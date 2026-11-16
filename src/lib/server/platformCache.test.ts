import { describe, expect, it, vi } from 'vitest'
import { cachedSetting, invalidatePlatformSettings } from './platformCache'

describe('platform settings cache', () => {
  it('reads through when no Next cache is available (tests, scripts)', async () => {
    const read = vi.fn(async () => 42)
    expect(await cachedSetting(['k'], read)).toBe(42)
  })
  it('lets a failed read reach the caller', async () => {
    await expect(cachedSetting(['k2'], async () => { throw new Error('db down') })).rejects.toThrow('db down')
  })
  it('invalidating outside a request never throws', () => {
    expect(() => invalidatePlatformSettings()).not.toThrow()
  })
})
