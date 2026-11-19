import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveApiUserId: async () => 'u1' }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

describe('POST /api/analytics/onboarding', () => {
  it('answers a JSON null body with 400, not 500', async () => {
    const res = await POST(new Request('http://x/api/analytics/onboarding', { method: 'POST', body: 'null' }))
    expect(res.status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
