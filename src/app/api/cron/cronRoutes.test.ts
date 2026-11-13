import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ refresh: vi.fn(), harvest: vi.fn(), service: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prices/runPriceRefresh', () => ({ runPriceRefresh: h.refresh }))
vi.mock('@/lib/sms/harvest', () => ({ harvestLegacySms: h.harvest }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.service }))

import { GET as prices } from './prices/route'
import { GET as monthCarry } from './month-carry/route'
import { GET as notifications, POST as notificationsPost } from './notifications/route'
import { GET as integrations } from './integrations/route'
import { GET as smsCanary } from './sms-canary/route'

const req = (auth?: string) => new Request('http://x/api/cron', { headers: auth ? { authorization: auth } : {} })

describe('cron auth: every money-moving or fan-out cron is closed to unauthenticated callers', () => {
  beforeEach(() => { h.refresh.mockReset(); h.harvest.mockReset(); h.service.mockReset(); process.env.CRON_SECRET = 's3cret' })

  const routes = { prices, 'month-carry': monthCarry, notifications, integrations, 'sms-canary': smsCanary }
  for (const [name, GET] of Object.entries(routes)) {
    it(`${name}: 401 with no header or a wrong secret, and never reaches the database`, async () => {
      expect((await GET(req())).status).toBe(401)
      expect((await GET(req('Bearer wrong'))).status).toBe(401)
      expect(h.service).not.toHaveBeenCalled()
    })
    it(`${name}: 401 when CRON_SECRET is unset, even for a "Bearer undefined" header`, async () => {
      delete process.env.CRON_SECRET
      expect((await GET(req('Bearer undefined'))).status).toBe(401)
      expect(h.service).not.toHaveBeenCalled()
    })
  }
})

describe('GET /api/cron/prices', () => {
  beforeEach(() => { h.refresh.mockReset(); h.harvest.mockReset(); h.service.mockReset().mockReturnValue({}); process.env.CRON_SECRET = 's3cret' })

  it('returns the refresh result with 200', async () => {
    h.refresh.mockResolvedValue({ updated: 4 })
    h.harvest.mockResolvedValue(0)
    const res = await prices(req('Bearer s3cret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 4 })
  })

  it('answers 500 when the refresh reports an error', async () => {
    h.refresh.mockResolvedValue({ error: 'provider down' })
    h.harvest.mockResolvedValue(0)
    expect((await prices(req('Bearer s3cret'))).status).toBe(500)
  })

  it('a failing SMS harvest does not fail the price refresh', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    h.refresh.mockResolvedValue({ updated: 1 })
    h.harvest.mockRejectedValue(new Error('db'))
    expect((await prices(req('Bearer s3cret'))).status).toBe(200)
  })
})

describe('the hourly database caller', () => {
  it('notifications accepts POST (net.http_post) with the same auth as GET', async () => {
    process.env.CRON_SECRET = 's3cret'
    expect(notificationsPost).toBe(notifications)
    expect((await notificationsPost(req('Bearer wrong'))).status).toBe(401)
  })
})
