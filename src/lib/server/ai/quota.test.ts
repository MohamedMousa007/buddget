import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))
vi.mock('@/lib/server/ai/spendGuard', () => ({ spendBlocks: async () => false }))

import { reserveAiQuota } from './quota'

const args = { userId: 'u1', feature: 'receipt' as const, estUnits: 5 }
const grant = { allowed: true, reservation_id: 'r1' }

describe('reserveAiQuota', () => {
  beforeEach(() => {
    rpc.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'
    process.env.SUPABASE_SECRET_KEY = 'k'
  })

  it('reserves through v2', async () => {
    rpc.mockResolvedValue({ data: grant, error: null })
    const r = await reserveAiQuota(args)
    expect(r).toMatchObject({ allowed: true, reservationId: 'r1' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('ai_quota_reserve_v2')
  })

  it('falls back to v1 when v2 is missing, without a retry delay', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } }).mockResolvedValueOnce({ data: grant, error: null })
    const r = await reserveAiQuota(args)
    expect(r).toMatchObject({ allowed: true })
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['ai_quota_reserve_v2', 'ai_quota_reserve'])
  })

  it('denies with the layer v2 reports', async () => {
    rpc.mockResolvedValue({ data: { allowed: false, layer: 'receipts_month', reset_at: 't' }, error: null })
    expect(await reserveAiQuota(args)).toEqual({ allowed: false, layer: 'receipts_month', resetAt: 't' })
  })
})
