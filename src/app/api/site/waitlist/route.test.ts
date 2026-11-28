import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), limited: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))

import { resetMemoryGate } from '@/lib/server/publicApiRateLimit'
import { POST } from './route'

let ipSeq = 0
const req = (body: unknown) => new Request('http://x/api/site/waitlist', {
  method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${++ipSeq}` }, body: JSON.stringify(body),
})
const ok = { locale: 'en', email: ' Sara@Example.com ', country: 'eg', platform: 'ios' }

beforeEach(() => {
  resetMemoryGate()
  h.limited.mockReset().mockResolvedValue(false)
  h.rpc.mockReset().mockResolvedValue({ data: [{ share_code: 'W7K2QXMA', referrals: 2, is_new: true }], error: null })
})

describe('POST /api/site/waitlist', () => {
  it('joins with a normalised email and country and returns the share code', async () => {
    const res = await POST(req(ok))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, shareCode: 'W7K2QXMA', referrals: 2 })
    expect(h.rpc).toHaveBeenCalledWith('waitlist_join', expect.objectContaining({ p_email: 'sara@example.com', p_country: 'EG', p_platform: 'ios', p_locale: 'en' }))
  })

  it('gives a repeat address no share code or count', async () => {
    h.rpc.mockResolvedValue({ data: [{ share_code: 'W7K2QXMA', referrals: 2, is_new: false }], error: null })
    const res = await POST(req(ok))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('routes a waitlist code to referred_by and an in-app code to app_invite_code', async () => {
    await POST(req({ ...ok, ref: 'w7k2qxmb' }))
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_referred_by: 'W7K2QXMB', p_app_invite_code: undefined })
    await POST(req({ ...ok, ref: 'layla-7k2' }))
    expect(h.rpc.mock.calls[1][1]).toMatchObject({ p_referred_by: undefined, p_app_invite_code: 'LAYLA-7K2' })
    await POST(req({ ...ok, ref: '<script>' }))
    expect(h.rpc.mock.calls[2][1]).toMatchObject({ p_referred_by: undefined, p_app_invite_code: undefined })
  })

  it('rejects a missing platform, a bad country and an unknown answer', async () => {
    expect((await POST(req({ ...ok, platform: undefined }))).status).toBe(400)
    expect((await POST(req({ ...ok, country: 'Egypt' }))).status).toBe(400)
    expect((await POST(req({ ...ok, wantMost: 'crypto' }))).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('tells a honeypot bot it worked and saves nothing', async () => {
    const res = await POST(req({ ...ok, company: 'Acme' }))
    expect(res.status).toBe(200)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('refuses a disposable mailbox', async () => {
    expect((await POST(req({ ...ok, email: 'x@mailinator.com' }))).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers 429 per IP, per address and per day without saving', async () => {
    h.limited.mockImplementation(async (_s: unknown, key: string) => key.startsWith('site-waitlist:'))
    expect((await POST(req(ok))).status).toBe(429)
    h.limited.mockImplementation(async (_s: unknown, key: string) => key === 'site-waitlist-email:sara@example.com')
    expect((await POST(req(ok))).status).toBe(429)
    h.limited.mockImplementation(async (_s: unknown, key: string) => key === 'site-waitlist-day')
    expect((await POST(req(ok))).status).toBe(429)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('answers 500 when the database fails', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    expect((await POST(req(ok))).status).toBe(500)
  })
})
