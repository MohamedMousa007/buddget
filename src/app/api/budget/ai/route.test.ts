import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn(), settle: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: async () => ({ id: 'u1', email: null, amr: [] }) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/entitlements/server', () => ({ getUserEntitlements: async () => ({ limits: { ai_budget_per_hour: null } }) }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: async () => ({ allowed: true }),
  settleAiQuota: h.settle,
  quotaDeniedResponse: () => new Response(null, { status: 429 }),
}))

import { POST } from './route'

const post = () =>
  POST(new Request('http://x/api/budget/ai', { method: 'POST', body: JSON.stringify({ op: 'situation', text: 'I rent', currency: 'EGP' }) }) as never)

describe('POST /api/budget/ai', () => {
  beforeEach(() => {
    h.fetch.mockReset()
    h.settle.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', h.fetch)
    vi.stubEnv('GEMINI_API_KEY', 'k')
  })

  it('settles the tokens Google billed even when the model output is not valid JSON', async () => {
    h.fetch.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } }), { status: 200 }),
    )
    await post()
    expect(h.settle.mock.calls[0][1].usage.outputTokens).toBeGreaterThan(0)
    expect(h.settle.mock.calls[0][1].status).toBe('error')
  })

  it('gives both attempts one shared deadline signal', async () => {
    h.fetch.mockResolvedValue(new Response('{}', { status: 503 }))
    await post()
    expect(h.fetch).toHaveBeenCalledTimes(2)
    expect(h.fetch.mock.calls[0][1].signal).toBe(h.fetch.mock.calls[1][1].signal)
  })
})
