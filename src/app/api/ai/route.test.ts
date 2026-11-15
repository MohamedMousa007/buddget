import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ call: vi.fn(), limited: vi.fn(), runtime: vi.fn(), settle: vi.fn(), ent: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/ai/auth', () => ({ requireAiUser: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/server/aiRuntimeConfig', () => ({ getEffectiveAiRuntimeConfig: h.runtime }))
vi.mock('@/lib/entitlements/server', () => ({ getUserEntitlements: h.ent }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: async () => ({ allowed: true }),
  settleAiQuota: h.settle,
  quotaDeniedResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('@/lib/server/ai/gemini', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/ai/gemini')>()),
  callGemini: h.call,
  retryOnOverload: (fn: () => Promise<Response>) => fn(),
}))

import { LEGACY_MODEL, TIER_MODELS } from '@/lib/server/ai/gemini'
import { POST } from './route'

const post = (body: unknown, headers?: Record<string, string>) =>
  POST(new Request('http://x/api/ai', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }))
const contents = [{ role: 'user', parts: [{ text: 'hi' }] }]

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    h.call.mockReset().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }))
    h.limited.mockReset().mockResolvedValue(false)
    h.settle.mockReset().mockResolvedValue(undefined)
    h.ent.mockReset().mockResolvedValue({ limits: { grounded_per_day: 3 } })
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

  it('settles an upstream timeout as aborted with the estimated usage, not as free', async () => {
    h.call.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    const res = await post({ contents, generationConfig: { maxOutputTokens: 500 } })
    expect(res.status).toBe(500)
    expect(h.settle).toHaveBeenCalledTimes(1)
    const [, args] = h.settle.mock.calls[0]
    expect(args.status).toBe('aborted')
    expect(args.usage.promptTokens).toBeGreaterThan(0)
    expect(args.usage.outputTokens).toBe(h.call.mock.calls[0][2].generationConfig.maxOutputTokens)
  })

  it('grants grounding under the daily limit and counts it per user', async () => {
    await post({ contents, grounded: true })
    expect(h.call.mock.calls[0][2].tools).toEqual([{ google_search: {} }])
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'ai-grounded:u1', 86_400, 3)
  })

  it('drops grounding, not the request, once the daily limit is reached', async () => {
    h.limited.mockImplementation(async (_c: unknown, key: string) => key.startsWith('ai-grounded:'))
    const res = await post({ contents, grounded: true })
    expect(res.status).toBe(200)
    expect(h.call.mock.calls[0][2]).not.toHaveProperty('tools')
    expect(res.headers.get('x-grounding')).toBe('limited')
  })

  it('tells the client on a stream response too', async () => {
    h.limited.mockImplementation(async (_c: unknown, key: string) => key.startsWith('ai-grounded:'))
    h.call.mockResolvedValue(new Response('data: {}\n\n', { status: 200 }))
    const res = await post({ contents, grounded: true, stream: true })
    expect(res.headers.get('x-grounding')).toBe('limited')
  })

  it('reads the allowance from the user entitlement limits', async () => {
    h.ent.mockResolvedValue({ limits: { grounded_per_day: 25 } })
    await post({ contents, grounded: true })
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'ai-grounded:u1', 86_400, 25)
  })

  it('does not cap grounding when the entitlement limit is unlimited', async () => {
    h.ent.mockResolvedValue({ limits: { grounded_per_day: null } })
    await post({ contents, grounded: true })
    expect(h.call.mock.calls[0][2].tools).toEqual([{ google_search: {} }])
    expect(h.limited.mock.calls.some((c) => String(c[1]).startsWith('ai-grounded:'))).toBe(false)
  })

  it('does not flag a request that was granted grounding', async () => {
    const res = await post({ contents, grounded: true })
    expect(res.headers.get('x-grounding')).toBeNull()
  })

  it('does not touch the grounding allowance for an ungrounded request', async () => {
    await post({ contents })
    expect(h.limited.mock.calls.some((c) => String(c[1]).startsWith('ai-grounded:'))).toBe(false)
  })

  describe('what the client can choose', () => {
    it('uses only a server tier model, never a client-sent model string', async () => {
      await post({ contents, model: 'gemini-evil', tier: 'smart' })
      expect(h.call.mock.calls[0][0]).toBe(TIER_MODELS.smart)
      await post({ contents, model: 'gemini-evil' })
      expect(h.call.mock.calls[1][0]).toBe(LEGACY_MODEL)
    })

    it('treats an inherited property name as no tier', async () => {
      await post({ contents, tier: 'toString' })
      expect(h.call.mock.calls[0][0]).toBe(LEGACY_MODEL)
    })

    it('clamps maxOutputTokens', async () => {
      await post({ contents, generationConfig: { maxOutputTokens: 1_000_000 } })
      expect(h.call.mock.calls[0][2].generationConfig.maxOutputTokens).toBe(8192)
    })

    it('never forwards tools, safetySettings, cachedContent or any other key', async () => {
      await post({ contents, tools: [{ code_execution: {} }], safetySettings: [], cachedContent: 'c', toolConfig: {}, extra: 1 })
      expect(Object.keys(h.call.mock.calls[0][2]).sort()).toEqual(['contents', 'generationConfig'])
    })

    it('rejects a file URI part', async () => {
      const res = await post({ contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'https://x/y', mimeType: 'image/png' } }] }] })
      expect(res.status).toBe(400)
      expect(h.call).not.toHaveBeenCalled()
    })

    it('rejects too many inline parts', async () => {
      const part = { inlineData: { mimeType: 'image/png', data: 'AA==' } }
      const res = await post({ contents: [{ role: 'user', parts: Array(5).fill(part) }] })
      expect(res.status).toBe(400)
      expect((await post({ contents: [{ role: 'user', parts: Array(4).fill(part) }] })).status).toBe(200)
    })
  })

  it('rejects by content-length before reading the body', async () => {
    const req = new Request('http://x/api/ai', { method: 'POST', headers: { 'content-length': '300000' }, body: '{}' })
    const text = vi.spyOn(req, 'text')
    expect((await POST(req)).status).toBe(413)
    expect(text).not.toHaveBeenCalled()
  })
})
