import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { cachedSetting } = vi.hoisted(() => ({
  cachedSetting: vi.fn((_keys: string[], read: () => Promise<unknown>, _ttl?: number) => read()),
}))
vi.mock('@/lib/server/platformCache', () => ({ cachedSetting }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: vi.fn() }))

import { loadPlans } from '@/lib/entitlements/server'

const serviceReturning = (result: { data: unknown; error: unknown }) =>
  ({ from: () => ({ select: () => Promise.resolve(result) }) }) as never

describe('loadPlans', () => {
  beforeEach(() => {
    cachedSetting.mockClear()
  })

  it('reads through the shared cache for 300 seconds', async () => {
    const rows = [{ key: 'free' }]
    expect(await loadPlans(serviceReturning({ data: rows, error: null }))).toEqual(rows)
    expect(cachedSetting.mock.calls[0]![0]).toEqual(['plans'])
    expect(cachedSetting.mock.calls[0]![2]).toBe(300)
  })

  it('throws on a Supabase error so a failed read is never cached', async () => {
    await expect(loadPlans(serviceReturning({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
