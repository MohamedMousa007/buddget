import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

import { POST } from './route'

const call = (body: string) =>
  POST(new Request('http://x/api/auth/check-email', { method: 'POST', headers: { 'x-real-ip': '1.2.3.4' }, body }))

beforeEach(() => {
  h.rpc.mockReset().mockImplementation(async (fn: string) =>
    fn === 'api_rate_hit' ? { data: true, error: null } : { data: { exists: true, verified: false }, error: null },
  )
})

describe('POST /api/auth/check-email', () => {
  it('answers a non-string email with 400, not 500', async () => {
    expect((await call(JSON.stringify({ email: 5 }))).status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('QA-99: fails closed when the counter errors, without looking the email up', async () => {
    h.rpc.mockImplementation(async (fn: string) => (fn === 'api_rate_hit' ? { data: null, error: { message: 'down' } } : { data: {}, error: null }))
    expect((await call(JSON.stringify({ email: 'a@b.co' }))).status).toBe(429)
    expect(h.rpc).not.toHaveBeenCalledWith('check_email_status', expect.anything())
  })

  it('QA-99: caps lookups per address per day', async () => {
    h.rpc.mockImplementation(async (fn: string, args: { p_key?: string }) =>
      fn === 'api_rate_hit' ? { data: !args.p_key?.startsWith('check-email-day:'), error: null } : { data: {}, error: null },
    )
    expect((await call(JSON.stringify({ email: 'a@b.co' }))).status).toBe(429)
    expect(h.rpc).toHaveBeenCalledWith('api_rate_hit', { p_key: 'check-email-day:1.2.3.4', p_window_seconds: 86_400, p_max_hits: 300 })
    expect(h.rpc).not.toHaveBeenCalledWith('check_email_status', expect.anything())
  })

  it('answers a normal lookup with exists and verified', async () => {
    const res = await call(JSON.stringify({ email: 'a@b.co' }))
    expect(await res.json()).toEqual({ exists: true, verified: false })
  })
})
