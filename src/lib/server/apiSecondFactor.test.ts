import { describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/supabase/resolveRouteUser', async (orig) => ({
  ...(await orig<typeof import('@/lib/supabase/resolveRouteUser')>()),
  verifyBearerJwt: async (t: string) => (t === 'a.b.c' ? { id: 'u1', email: null, amr: [{ method: 'password', timestamp: 1 }], sessionId: 's-bearer' } : null),
}))
import { apiSecondFactorRefusal, needsSecondFactor } from './apiSecondFactor'

const req = (bearer?: string) => ({ headers: new Headers(bearer ? { authorization: `Bearer ${bearer}` } : {}) }) as unknown as NextRequest
const claims = (sid: string) => ({ sub: 'u1', role: 'authenticated', session_id: sid, amr: [{ method: 'password', timestamp: 1 }] })
const admin = (data: unknown, error: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error })) }) as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> }

describe('API second-factor gate', () => {
  it('only gates /api routes that are not auth, cron, webhooks or public', () => {
    expect(needsSecondFactor('/api/devices')).toBe(true)
    expect(needsSecondFactor('/api/sms/setup-token')).toBe(true)
    expect(needsSecondFactor('/api/auth/second-factor')).toBe(false)
    expect(needsSecondFactor('/api/cron/prices')).toBe(false)
    expect(needsSecondFactor('/api/admin/users')).toBe(false)
    expect(needsSecondFactor('/flow')).toBe(false)
  })

  it('refuses an unverified cookie session with the code the app turns into the challenge', async () => {
    const res = await apiSecondFactorRefusal(req(), '/api/devices', claims('s-unverified'), admin(false))
    expect(res?.status).toBe(403)
    expect(res?.headers.get('x-second-factor-required')).toBe('true')
    expect(await res?.json()).toMatchObject({ error: 'second_factor_required' })
  })

  it('refuses an unverified bearer session and passes a verified one (cached for a minute)', async () => {
    expect((await apiSecondFactorRefusal(req('a.b.c'), '/api/devices', null, admin(false)))?.status).toBe(403)
    const ok = admin(true)
    expect(await apiSecondFactorRefusal(req('a.b.c'), '/api/devices', null, ok)).toBeNull()
    expect(await apiSecondFactorRefusal(req('a.b.c'), '/api/devices', null, ok)).toBeNull()
    expect(ok.rpc).toHaveBeenCalledTimes(1)
  })

  it('lets anonymous callers, opaque tokens and exempt routes through without asking the database', async () => {
    const a = admin(false)
    expect(await apiSecondFactorRefusal(req(), '/api/devices', null, a)).toBeNull()
    expect(await apiSecondFactorRefusal(req('opaque-sms-token'), '/api/sms/parse', null, a)).toBeNull()
    expect(await apiSecondFactorRefusal(req(), '/api/auth/second-factor', claims('s-x'), a)).toBeNull()
    expect(a.rpc).not.toHaveBeenCalled()
  })

  it('fails open when the check itself errors, so an outage cannot lock the API', async () => {
    expect(await apiSecondFactorRefusal(req(), '/api/devices', claims('s-err'), admin(null, { message: 'down' }))).toBeNull()
  })
})
