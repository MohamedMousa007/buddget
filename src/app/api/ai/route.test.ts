import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ call: vi.fn(), limited: vi.fn(), runtime: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/ai/auth', () => ({ requireAiUser: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/server/aiRuntimeConfig', () => ({ getEffectiveAiRuntimeConfig: h.runtime }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: async () => ({ allowed: true }),
  settleAiQuota: async () => undefined,
  quotaDeniedResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('@/lib/server/ai/gemini', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/ai/gemini')>()),
  callGemini: h.call,
  retryOnOverload: (fn: () => Promise<Response>) => fn(),
}))

import { POST } from './route'

const post = (body: unknown) => POST(new Request('http://x/api/ai', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))
const contents = [{ role: 'user', parts: [{ text: 'hi' }] }]

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    h.call.mockReset().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }))
    h.limited.mockReset().mockResolvedValue(false)
    h.runtime.mockReset().mockResolvedValue({ rateLimitingEnabled: true, rateLimitMaxRequests: 5, rateLimitWindowMs: 60_000 })
  })

  it('rejects an oversized body before parsing it', async () => {
    expect((await post('x'.repeat(300_000))).status).toBe(413)
    expect(h.call).not.toHaveBeenCalled()
  })

  it('rate limits through the shared counter, per user', async () => {
    h.limited.mockResolvedValue(true)
    expect((await post({ contents })).status).toBe(429)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'ai:u1', 60, 5, true)
  })

  it('does not forward candidateCount or an oversized thinking budget', async () => {
    await post({ contents, generationConfig: { candidateCount: 8, thinkingConfig: { thinkingBudget: 50_000 } } })
    const sent = h.call.mock.calls[0][2].generationConfig
    expect(sent).not.toHaveProperty('candidateCount')
    expect(sent.thinkingConfig).toEqual({ thinkingBudget: 2048 })
  })

  it('ignores grounding on the fast tier', async () => {
    await post({ contents, tier: 'fast', grounded: true })
    expect(h.call.mock.calls[0][2]).not.toHaveProperty('tools')
  })

  it('hides the upstream error text and maps a 503 away from "not configured"', async () => {
    h.call.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'projects/123 quota detail' } }), { status: 503 }))
    const res = await post({ contents })
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('projects/123')
  })

  it('answers invalid JSON with 400, not 500', async () => {
    expect((await post('{nope')).status).toBe(400)
    expect(h.call).not.toHaveBeenCalled()
  })

  it('bounds every upstream call with a deadline signal inside the function budget', async () => {
    await post({ contents })
    expect(h.call.mock.calls[0][4]).toBeInstanceOf(AbortSignal)
  })

  it('cancels the first response body before falling back to the legacy model', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const first = new Response('x', { status: 404 })
    first.body!.cancel = cancel as never
    h.call.mockResolvedValueOnce(first)
    await post({ contents, tier: 'fast' })
    expect(cancel).toHaveBeenCalled()
    expect(h.call).toHaveBeenCalledTimes(2)
  })
})
