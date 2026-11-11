import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const limited = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ insert }) }) }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: (...a: unknown[]) => limited(...a) }))

import { POST } from './route'

const req = (body: unknown) => new Request('http://x/api/site/lead', { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: JSON.stringify(body) })
const ok = { kind: 'waitlist', locale: 'en', email: 'a@b.co' }

beforeEach(() => { insert.mockReset().mockResolvedValue({ error: null }); limited.mockReset().mockResolvedValue(false) })

describe('POST /api/site/lead', () => {
  it('saves a lead and asks the shared limiter, keyed by IP, to fail open', async () => {
    const res = await POST(req(ok))
    expect(res.status).toBe(200)
    expect(limited).toHaveBeenCalledWith(expect.anything(), 'site-lead:1.2.3.4', 60, 5, true)
    expect(insert).toHaveBeenCalled()
  })
  it('answers 429 and saves nothing when the limiter says so', async () => {
    limited.mockResolvedValue(true)
    const res = await POST(req(ok))
    expect(res.status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })
  it('treats a repeat sign-up as success', async () => {
    insert.mockResolvedValue({ error: { code: '23505' } })
    expect((await POST(req(ok))).status).toBe(200)
  })

  it('ADS-5 caps one address per hour and every sign-up per day', async () => {
    limited.mockImplementation(async (_s: unknown, key: string) => key.startsWith('site-lead-email:'))
    expect((await POST(req(ok))).status).toBe(429)
    expect(limited).toHaveBeenCalledWith(expect.anything(), 'site-lead-email:a@b.co', 3600, 3, true)
    expect(insert).not.toHaveBeenCalled()
    limited.mockImplementation(async (_s: unknown, key: string) => key === 'site-lead-day')
    expect((await POST(req(ok))).status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })
})
