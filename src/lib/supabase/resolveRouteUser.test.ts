import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), claims: null as Record<string, unknown> | null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/env', () => ({ requireSupabaseUrl: () => 'http://sb', requireSupabasePublishableKey: () => 'pk' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: h.claims } }) } }) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { resolveRouteIdentity, sessionLive } from './resolveRouteUser'

const cookieCall = () => resolveRouteIdentity(new Request('http://x/api/any'))

beforeEach(() => {
  h.claims = { sub: 'u1', role: 'authenticated', session_id: 's1' }
  h.rpc.mockReset().mockResolvedValue({ data: true, error: null })
})

describe('S8C-02: a revoked session is refused on the app routes', () => {
  it('passes a live session and refuses one the database says is gone', async () => {
    expect((await cookieCall())?.id).toBe('u1')
    expect(h.rpc).toHaveBeenCalledWith('session_is_live', { p_session: 's1' })
    h.rpc.mockResolvedValue({ data: false, error: null })
    expect(await cookieCall()).toBeNull()
  })

  it('fails open when the check itself fails, and skips tokens without a session id', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    expect(await sessionLive('s1')).toBe(true)
    h.rpc.mockRejectedValue(new Error('network'))
    expect(await sessionLive('s1')).toBe(true)
    h.rpc.mockReset()
    expect(await sessionLive(null)).toBe(true)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
