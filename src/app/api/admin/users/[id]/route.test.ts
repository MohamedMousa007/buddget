import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ audit: vi.fn(), entitlement: null as Record<string, unknown> | null, banned: null as string | null }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/server/deleteAccount', () => ({ deleteUserCompletely: vi.fn() }))
vi.mock('@/lib/server/userData', () => ({ removeAvatarObject: vi.fn(), stampDataReset: vi.fn(), wipeUserData: vi.fn() }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: vi.fn() }))
vi.mock('@/lib/server/sendNativePush', () => ({ sendNativePush: vi.fn() }))
vi.mock('@/lib/server/admin/stepUp', () => ({ STEP_UP_ERROR: 'step', stepUp: async () => true }))
vi.mock('@/lib/server/admin/targets', () => ({ blockedTarget: async () => null, UUID_RE: /^[0-9a-f-]{36}$/i }))
vi.mock('@/lib/server/admin/staffActionGuards', () => ({ allowUserAction: async () => true, auditPiiRead: vi.fn() }))
vi.mock('@/lib/server/admin/guard', () => {
  const table = () => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: h.entitlement }),
      single: async () => ({ data: { key: 'free' } }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async () => ({ error: null }),
      insert: async () => ({ error: null }),
    })
    return q
  }
  const service = {
    from: (t: string) => (t === 'plans' ? Object.assign(table(), { maybeSingle: async () => ({ data: { key: 'pro', trial_days: 14 } }) }) : table()),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'a@b.co', banned_until: h.banned } } }), updateUserById: async () => ({ error: null }) } },
  }
  return {
    guardAdmin: async () => ({ ok: true, ctx: { service, permissions: ['*'], role: { key: 'owner' }, staff: { id: 's1', email: 'o@x.co', display_name: null }, audit: h.audit } }),
    json: (b: unknown, status = 200) => Response.json(b, { status }),
    bad: (m: string, status = 400) => Response.json({ error: m }, { status }),
    maskEmail: (e: string | null) => e,
    readJson: async (req: Request) => req.json(),
  }
})
vi.mock('@/lib/admin/permissions', async (orig) => ({ ...(await orig<object>()), can: () => true }))

import { POST } from './route'

const ID = '11111111-1111-4111-8111-111111111111'
const post = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: ID }) })
const meta = () => (h.audit.mock.calls.at(-1)![1] as { metadata: Record<string, unknown> }).metadata

beforeEach(() => {
  h.audit.mockReset()
  h.entitlement = { user_id: ID, plan_key: 'pro', status: 'active', limit_overrides: { ai_chat_per_day: 5 }, feature_overrides: {} }
  h.banned = null
})

describe('ADS-2 audit rows keep the before-state', () => {
  it('set_entitlement records the replaced membership', async () => {
    await post({ op: 'set_entitlement', planKey: 'pro', status: 'canceled' })
    expect(meta().before).toMatchObject({ plan_key: 'pro', status: 'active' })
  })
  it('clear_entitlement stores the deleted row', async () => {
    await post({ op: 'clear_entitlement' })
    expect(meta().before).toMatchObject({ plan_key: 'pro', limit_overrides: { ai_chat_per_day: 5 } })
  })
  it('set_limits records the previous overrides', async () => {
    await post({ op: 'set_limits', limits: { ai_chat_per_day: 9 } })
    expect(meta().before).toEqual({ limits: { ai_chat_per_day: 5 }, features: {} })
  })
  it('suspend and restore record the prior ban state', async () => {
    h.banned = '2030-01-01T00:00:00Z'
    await post({ op: 'restore' })
    expect(meta().before).toEqual({ bannedUntil: '2030-01-01T00:00:00Z' })
  })
})
