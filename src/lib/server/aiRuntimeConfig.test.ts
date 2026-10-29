import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ row: null as { value: unknown } | null, upsert: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row, error: null }) }) }),
      upsert: async (...a: unknown[]) => {
        h.upsert(...a)
        return { error: null }
      },
    }),
  }),
}))

import { getEffectiveAiRuntimeConfig, getStoredAiRuntimeConfig, saveAiRuntimeConfig, resetAiRuntimeConfigCache } from './aiRuntimeConfig'

beforeEach(() => {
  h.row = null
  h.upsert.mockReset()
  resetAiRuntimeConfigCache()
  vi.unstubAllEnvs()
})

describe('aiRuntimeConfig (platform_settings backed)', () => {
  it('falls back to env defaults when no row exists', async () => {
    expect(await getStoredAiRuntimeConfig()).toEqual({ rateLimitingEnabled: false, rateLimitMaxRequests: 15, rateLimitWindowMs: 60_000 })
  })

  it('reads the stored throttle from the database and clamps it', async () => {
    h.row = { value: { rateLimitingEnabled: true, rateLimitMaxRequests: 99999, rateLimitWindowMs: 30_000 } }
    expect(await getStoredAiRuntimeConfig()).toEqual({ rateLimitingEnabled: true, rateLimitMaxRequests: 1000, rateLimitWindowMs: 30_000 })
  })

  it('lets env override the stored value', async () => {
    h.row = { value: { rateLimitingEnabled: false, rateLimitMaxRequests: 10, rateLimitWindowMs: 60_000 } }
    vi.stubEnv('AI_RATE_LIMIT_MAX', '40')
    expect((await getEffectiveAiRuntimeConfig()).rateLimitMaxRequests).toBe(40)
  })

  it('saves to platform_settings, not the local disk', async () => {
    const next = await saveAiRuntimeConfig({ rateLimitingEnabled: true, rateLimitMaxRequests: 5 }, 'staff-1')
    expect(next).toMatchObject({ rateLimitingEnabled: true, rateLimitMaxRequests: 5 })
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'ai_throttle', updated_by: 'staff-1' }))
  })
})
