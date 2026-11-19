import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiIdentity: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/entitlements/billingSwitch', () => ({ billingEnabled: async () => true }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const call = (body: string) => POST(new Request('http://x/api/billing/paywall-view', { method: 'POST', body }))
const recorded = () => h.rpc.mock.calls.filter(([fn]) => fn === 'record_paywall_view')

beforeEach(() => {
  h.rpc.mockReset().mockImplementation(async (fn: string) => ({ data: fn === 'api_rate_hit' ? true : null, error: null }))
})

describe('POST /api/billing/paywall-view', () => {
  it('treats a JSON null body like an empty one instead of a 500', async () => {
    const res = await call('null')
    expect(res.status).toBe(200)
    expect(recorded()[0]?.[1]).toMatchObject({ p_platform: '', p_source: '' })
  })
})
