import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/platformCache', () => ({ cachedSetting: (_keys: string[], read: () => Promise<unknown>) => read() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))

import { requireFeature } from './server'

const service = (opts: { override?: unknown; planFeatures?: string[]; failed?: boolean }) =>
  ({
    from: (table: string) => ({
      select: () => {
        if (table === 'plans') {
          const res = opts.failed
            ? { data: null, error: { message: 'down' } }
            : { data: [{ key: 'free', name: 'Free', limits: {}, features: opts.planFeatures ?? [], trial_days: 0, is_default: true }], error: null }
          return Promise.resolve(res)
        }
        return {
          eq: () => ({
            maybeSingle: async () =>
              opts.failed
                ? { data: null, error: { message: 'down' } }
                : { data: opts.override === undefined ? null : { plan_key: 'free', status: 'active', trial_ends_at: null, current_period_end: null, limit_overrides: {}, feature_overrides: { k: opts.override } }, error: null },
          }),
        }
      },
    }),
  }) as never

const paid = new Set(['k'])

describe('requireFeature', () => {
  it('lets an unpaid key through with no override', async () => {
    expect(await requireFeature('u', 'k', service({}), new Set())).toBeNull()
  })
  it('denies 403 on an override of false', async () => {
    expect((await requireFeature('u', 'k', service({ override: false }), new Set()))?.status).toBe(403)
  })
  it('denies 403 for a paid key the plan lacks and allows one it lists', async () => {
    expect((await requireFeature('u', 'k', service({}), paid))?.status).toBe(403)
    expect(await requireFeature('u', 'k', service({ planFeatures: ['k'] }), paid)).toBeNull()
  })
  it('answers 503 for a paid key when the entitlement read fails, and allows an unpaid key', async () => {
    expect((await requireFeature('u', 'k', service({ failed: true }), paid))?.status).toBe(503)
    expect(await requireFeature('u', 'k', service({ failed: true }), new Set())).toBeNull()
  })
})
