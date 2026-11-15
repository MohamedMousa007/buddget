import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  limited: vi.fn(),
  fetchRates: vi.fn(),
  drift: vi.fn(),
  apply: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: async () => 'u1' }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}))
vi.mock('@/lib/server/carryCycle', () => ({ closedCycleDrift: h.drift, fetchRates: h.fetchRates }))
vi.mock('@/lib/server/carryAdjust', () => ({ applyCarryDrift: h.apply }))

import { GET, POST } from './route'

const post = () => new Request('http://x/api/savings/carry', { method: 'POST', body: JSON.stringify({ monthKey: '2026-10' }) })

describe('savings carry rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.limited.mockResolvedValue(false)
    h.fetchRates.mockResolvedValue({ USD_EGP: 50 })
    h.drift.mockResolvedValue([])
  })
  it('answers 429 before fetching rates when the user is over the limit', async () => {
    h.limited.mockResolvedValue(true)
    expect((await GET(new Request('http://x/api/savings/carry'))).status).toBe(429)
    expect((await POST(post())).status).toBe(429)
    expect(h.fetchRates).not.toHaveBeenCalled()
  })
  it('limits 20 a minute per user, failing closed', async () => {
    await GET(new Request('http://x/api/savings/carry'))
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'savings-carry:u1', 60, 20)
  })
  it('serves the request when under the limit', async () => {
    expect((await GET(new Request('http://x/api/savings/carry'))).status).toBe(200)
  })
})
