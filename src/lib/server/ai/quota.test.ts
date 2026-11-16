import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))
vi.mock('@/lib/server/ai/spendGuard', () => ({ spendBlocks: async () => false }))
const feature = vi.hoisted(() => ({ require: vi.fn(), paid: new Set<string>() }))
vi.mock('@/lib/entitlements/server', () => ({ requireFeature: feature.require }))
vi.mock('@/lib/entitlements/limits', () => ({ PAID_FEATURES: feature.paid }))

import { reserveAiQuota, settleAiQuota } from './quota'

const args = { userId: 'u1', feature: 'receipt' as const, estUnits: 5 }
const grant = { allowed: true, reservation_id: 'r1' }

describe('reserveAiQuota', () => {
  beforeEach(() => {
    rpc.mockReset()
    feature.require.mockReset().mockResolvedValue(null)
    feature.paid.clear()
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

  it('skips the feature check for a key that is not paid', async () => {
    rpc.mockResolvedValue({ data: grant, error: null })
    await reserveAiQuota(args)
    expect(feature.require).not.toHaveBeenCalled()
  })

  it('refuses before reserving when requireFeature denies a paid key', async () => {
    feature.paid.add('receipt_scanning')
    feature.require.mockResolvedValue(new Response(null, { status: 503 }))
    expect(await reserveAiQuota(args)).toEqual({ allowed: false, layer: 'unavailable', resetAt: null })
    expect(feature.require).toHaveBeenCalledWith('u1', 'receipt_scanning')
    expect(rpc).not.toHaveBeenCalled()
    feature.require.mockResolvedValue(new Response(null, { status: 403 }))
    expect(await reserveAiQuota(args)).toEqual({ allowed: false, layer: 'feature_disabled', resetAt: null })
  })
})

describe('reserve and settle by cost', () => {
  beforeEach(() => {
    rpc.mockReset()
    feature.require.mockReset().mockResolvedValue(null)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'
    process.env.SUPABASE_SECRET_KEY = 'k'
  })

  it('passes a free Advisor answer to the reservation, and nothing extra otherwise', async () => {
    rpc.mockResolvedValue({ data: grant, error: null })
    await reserveAiQuota({ ...args, feature: 'chat', advisorFree: true })
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_advisor_free: true })
    rpc.mockClear()
    await reserveAiQuota({ ...args, feature: 'chat' })
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty('p_advisor_free')
  })

  it.each(['session', 'week'] as const)('denies with the %s window and its reset time', async (layer) => {
    rpc.mockResolvedValue({ data: { allowed: false, layer, reset_at: '2026-11-20T22:00:00Z' }, error: null })
    expect(await reserveAiQuota(args)).toEqual({ allowed: false, layer, resetAt: '2026-11-20T22:00:00Z' })
  })

  it('settles with audio seconds and the extra provider cost only when there are some', async () => {
    rpc.mockResolvedValue({ error: null })
    const g = { allowed: true as const, userId: 'u1', reservationId: 'r1', chatId: null, newChat: false, rolled: false, soft: false, disabled: [] }
    const base = { model: 'm', tier: 't', latencyMs: 1, usage: { promptTokens: 1, cachedTokens: 0, outputTokens: 1 }, status: 'ok' as const }
    await settleAiQuota(g, { ...base, audioSeconds: 12.2, extraCostMicro: 14000 })
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_audio_seconds: 13, p_extra_cost_micro: 14000 })
    rpc.mockClear()
    await settleAiQuota(g, base)
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty('p_audio_seconds')
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty('p_extra_cost_micro')
  })
})
