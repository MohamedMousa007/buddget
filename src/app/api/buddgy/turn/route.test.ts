import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn(), call: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/ai/auth', () => ({ requireAiUser: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/server/ai/quota', () => ({ reserveAiQuota: h.reserve, settleAiQuota: h.settle, quotaDeniedResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/server/ai/gemini', async (orig) => ({ ...(await orig<typeof import('@/lib/server/ai/gemini')>()), callGeminiResilient: h.call }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/entitlements/billingSwitch', () => ({ billingEnabled: async () => false }))
vi.mock('@/lib/entitlements/server', () => ({ getUserEntitlements: async () => ({ planKey: 'free' }) }))

import { POST } from './route'

// The mocks are shared across tests; each test sees only its own calls.
beforeEach(() => vi.clearAllMocks())

const sseBody = (frames: unknown[]) => {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode(`data: ${JSON.stringify(f)}\n\n`))
      c.close()
    },
  })
}

// BDG-013: past the chat's spend line the server used to send `soft: true`, which made every client (installed builds
// too) cut the history to 2 items and say "this chat is getting long". The server now never sends it.
describe('POST /api/buddgy/turn, spend line', () => {
  it('sends soft: false in the meta frame even when the chat is past its spend line', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    h.reserve.mockResolvedValueOnce({ allowed: true, userId: 'u1', reservationId: 'r1', chatId: 'c1', newChat: false, rolled: false, soft: true, disabled: [] })
    h.call.mockResolvedValueOnce({
      model: 'm',
      res: new Response(sseBody([{ candidates: [{ content: { parts: [{ text: 'Hello' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } }])),
    })
    const req = new Request('http://x/api/buddgy/turn', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }], context: 'now', locale: 'en' }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const frames = (await res.text()).split('\n\n').filter(Boolean).map((l) => JSON.parse(l.slice(5)))
    expect(frames[0]).toMatchObject({ t: 'meta', chatId: 'c1', soft: false })
    // BDG-010: an answer turn runs at the minimal thinking level, so it is labelled Quick.
    expect(frames[0]).toMatchObject({ mode: 'quick' })
    expect(frames.at(-1)).toMatchObject({ t: 'done' })
    expect(h.settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'ok' }))
  })
})

// BDG-011 slice 2 (0338): one user message is charged as one turn. The route tells settle whether a call was a tool
// step (the model asked the phone for data and hops are left) and whether the user saw anything.
describe('POST /api/buddgy/turn, one charge per turn', () => {
  const turnId = '33333333-3333-4333-8333-333333333333'
  const run = async (part: unknown, body: Record<string, unknown>) => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    h.reserve.mockResolvedValueOnce({ allowed: true, userId: 'u1', reservationId: 'r1', chatId: 'c1', newChat: false, rolled: false, soft: false, disabled: [] })
    h.call.mockResolvedValueOnce({
      model: 'm',
      res: new Response(sseBody([{ candidates: [{ content: { parts: [part] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } }])),
    })
    const req = new Request('http://x/api/buddgy/turn', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }], context: 'now', locale: 'en', ...body }) })
    await (await POST(req)).text()
  }

  it('a lookup is a provisional tool step that showed nothing, and the turn id reaches the reservation', async () => {
    await run({ functionCall: { name: 'get_budget', args: {} } }, { turnId })
    expect(h.reserve).toHaveBeenCalledWith(expect.objectContaining({ turnId }))
    expect(h.settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'ok', provisional: true, visible: false }))
  })

  it('an answer ends the turn and was seen', async () => {
    await run({ text: 'Hello' }, { turnId })
    expect(h.settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'ok', provisional: false, visible: true }))
  })

  it('a request without a turn id settles per request, as installed builds do', async () => {
    await run({ functionCall: { name: 'get_budget', args: {} } }, {})
    const settled = h.settle.mock.calls[0]![1] as Record<string, unknown>
    expect(settled).not.toHaveProperty('provisional')
    expect(settled).not.toHaveProperty('visible')
  })

  it('refuses a turn id that is not a uuid', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    const req = new Request('http://x/api/buddgy/turn', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', text: 'hi' }], context: 'now', locale: 'en', turnId: 'nope' }) })
    expect((await POST(req)).status).toBe(400)
    expect(h.reserve).not.toHaveBeenCalled()
  })
})

describe('POST /api/buddgy/turn', () => {
  it('rejects by content-length before reading the body', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    const req = new Request('http://x/api/buddgy/turn', { method: 'POST', headers: { 'content-length': '300000' }, body: '{}' })
    const json = vi.spyOn(req, 'json')
    expect((await POST(req)).status).toBe(413)
    expect(json).not.toHaveBeenCalled()
    expect(h.reserve).not.toHaveBeenCalled()
  })
})
