import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const registered = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: registered }) }) }) }),
  }),
}))

import { POST } from './route'

const SECRET = 's3cret'
const USER = '11111111-1111-4111-8111-111111111111'
const event = (extra: object = {}) => ({ title: 'Boom', issue_id: 7, event_id: 'ev1', release: 'r', datetime: new Date().toISOString(), tags: [['build', '12'], ['device_id', 'dev-1']], user: { id: USER }, ...extra })

function req(ev: object = event(), headers: Record<string, string> = {}) {
  const body = JSON.stringify({ data: { event: ev } })
  const sig = createHmac('sha256', SECRET).update(body).digest('hex')
  return new Request('http://x/api/webhooks/sentry', { method: 'POST', body, headers: { 'sentry-hook-signature': sig, ...headers } })
}

describe('sentry webhook', () => {
  beforeEach(() => {
    rpc.mockReset()
    registered.mockReset().mockResolvedValue({ data: null })
    process.env.SENTRY_WEBHOOK_SECRET = SECRET
  })

  it('records through v2 with the event id', async () => {
    rpc.mockResolvedValue({ error: null })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('record_client_crash_v2', expect.objectContaining({ p_event_id: 'ev1', p_build: '12' }))
  })

  it('falls back to v1 when v2 is not deployed', async () => {
    rpc.mockResolvedValueOnce({ error: { code: 'PGRST202' } }).mockResolvedValueOnce({ error: null })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenNthCalledWith(2, 'record_client_crash', expect.not.objectContaining({ p_event_id: expect.anything() }))
  })

  it('500s on a real database error', async () => {
    rpc.mockResolvedValue({ error: { code: 'XX000' } })
    expect((await POST(req())).status).toBe(500)
  })

  it('AUT-4: a delivery with no stamp and an old event is a replay', async () => {
    rpc.mockResolvedValue({ error: null })
    const old = new Date(Date.now() - 3 * 3600_000).toISOString()
    expect((await POST(req(event({ datetime: old })))).status).toBe(400)
    expect((await POST(req(event({ datetime: undefined })))).status).toBe(400)
    expect((await POST(req(event({ datetime: old }), { 'sentry-hook-timestamp': String(Date.now() / 1000) }))).status).toBe(200)
  })

  it('SST-3: the Sentry user id is kept only when the device tag is registered to that account', async () => {
    rpc.mockResolvedValue({ error: null })
    await POST(req())
    expect(rpc).toHaveBeenLastCalledWith('record_client_crash_v2', expect.objectContaining({ p_user_id: null }))
    registered.mockResolvedValue({ data: { device_id: 'dev-1' } })
    await POST(req())
    expect(rpc).toHaveBeenLastCalledWith('record_client_crash_v2', expect.objectContaining({ p_user_id: USER }))
  })
})
