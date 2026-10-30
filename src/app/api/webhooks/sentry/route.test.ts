import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))

import { POST } from './route'

const SECRET = 's3cret'
const body = JSON.stringify({ data: { event: { title: 'Boom', issue_id: 7, event_id: 'ev1', release: 'r', tags: [['build', '12']] } } })

function req() {
  const sig = createHmac('sha256', SECRET).update(body).digest('hex')
  return new Request('http://x/api/webhooks/sentry', { method: 'POST', body, headers: { 'sentry-hook-signature': sig } })
}

describe('sentry webhook', () => {
  beforeEach(() => {
    rpc.mockReset()
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
})
