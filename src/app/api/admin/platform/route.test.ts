import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ stepUp: vi.fn(), audit: vi.fn(), save: vi.fn(), upsert: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/config', () => ({ APP_CONFIG: { url: 'x' } }))
vi.mock('@/lib/server/firebaseAdmin', () => ({ getFirebaseAdmin: () => null }))
vi.mock('@/lib/admin/permissions', () => ({ can: () => true }))
vi.mock('@/lib/admin/minVersion', () => ({ confirmsLockOut: () => true, exceedsLatestRelease: () => false, LOCK_OUT_CONFIRMATION: 'x' }))
vi.mock('@/lib/server/aiRuntimeConfig', () => ({
  getEffectiveAiRuntimeConfig: async () => ({}),
  getStoredAiRuntimeConfig: async () => ({ rateLimitingEnabled: true, rateLimitMaxRequests: 15 }),
  saveAiRuntimeConfig: h.save,
}))
vi.mock('@/lib/server/admin/stepUp', () => ({ STEP_UP_ERROR: 'step-up', stepUp: h.stepUp }))
vi.mock('@/lib/server/admin/guard', () => ({
  guardAdmin: async () => ({
    ok: true,
    ctx: {
      permissions: [],
      staff: { id: 's' },
      audit: h.audit,
      service: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: { enabled: false } } }) }) }), upsert: h.upsert }) },
    },
  }),
  json: (b: unknown, status = 200) => Response.json(b, { status }),
  bad: (m: string, status = 400) => Response.json({ error: m }, { status }),
  readJson: async (req: Request) => req.json(),
}))

import { PATCH, POST } from './route'

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset())
  h.stepUp.mockResolvedValue(false)
  h.save.mockResolvedValue({})
  h.upsert.mockResolvedValue({ error: null })
})

describe('ADS-14 platform switches need proof', () => {
  it('turning maintenance on needs step-up', async () => {
    expect((await POST(req({ op: 'set_setting', key: 'maintenance', value: { enabled: true, message: 'x' } }))).status).toBe(401)
    expect(h.upsert).not.toHaveBeenCalled()
  })
  it('turning maintenance off or editing the announcement does not', async () => {
    expect((await POST(req({ op: 'set_setting', key: 'maintenance', value: { enabled: false, message: '' } }))).status).toBe(200)
    expect((await POST(req({ op: 'set_setting', key: 'announcement', value: { enabled: true, text: 'hi', tone: 'info' } }))).status).toBe(200)
  })
  it('switching the AI throttle off needs step-up; tuning it does not; the audit keeps the previous values', async () => {
    expect((await PATCH(req({ aiRuntime: { rateLimitingEnabled: false } }))).status).toBe(401)
    expect(h.save).not.toHaveBeenCalled()
    expect((await PATCH(req({ aiRuntime: { rateLimitingEnabled: true, rateLimitMaxRequests: 20 } }))).status).toBe(200)
    expect(h.audit.mock.calls.at(-1)![1].metadata.before).toMatchObject({ rateLimitMaxRequests: 15 })
  })
})
