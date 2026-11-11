import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), fetch: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: h.identity }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: async () => ({ allowed: true }),
  settleAiQuota: async () => undefined,
  quotaDeniedResponse: () => new Response(null, { status: 429 }),
}))

import { POST } from './route'

const good = { isReceipt: true, merchant: 'Spinneys', amount: 10, currency: 'EGP', date: '', category: 'Food', taxIncluded: true, confidence: 0.9, items: [{ name: 'Milk', price: 10 }], charges: [], notes: '' }
const gemini = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const ok = (obj: unknown) => gemini({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] })
const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'r', { type })
const call = (files: File[]) => {
  const form = new FormData()
  files.forEach((f) => form.append('image', f))
  return POST(new Request('http://x/api/receipt/scan', { method: 'POST', body: form }) as never)
}

describe('POST /api/receipt/scan', () => {
  beforeEach(() => {
    h.identity.mockReset().mockResolvedValue({ id: 'u1', email: null, amr: [] })
    h.fetch.mockReset()
    vi.stubGlobal('fetch', h.fetch)
    vi.stubEnv('GEMINI_API_KEY', 'k')
  })

  it('rejects a non-image before reading it', async () => {
    expect((await call([file('application/pdf')])).status).toBe(415)
    expect(h.fetch).not.toHaveBeenCalled()
  })

  it('maps an upstream 403 to 502 so the app does not read it as a sign-out', async () => {
    h.fetch.mockResolvedValue(gemini({ error: { message: 'API key invalid' } }, 403))
    const res = await call([file('image/jpeg')])
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('API key')
  })

  it('rejects model output that does not match the receipt shape', async () => {
    h.fetch.mockResolvedValue(ok({ ...good, amount: 'lots' }))
    expect((await call([file('image/jpeg')])).status).toBe(422)
  })

  it('BAI-10 rejects an absurd total or item price', async () => {
    h.fetch.mockResolvedValue(ok({ ...good, amount: 1e15 }))
    expect((await call([file('image/jpeg')])).status).toBe(422)
    h.fetch.mockResolvedValue(ok({ ...good, items: [{ name: 'Milk', price: 1e15 }] }))
    expect((await call([file('image/jpeg')])).status).toBe(422)
  })

  it('returns a valid receipt', async () => {
    h.fetch.mockResolvedValue(ok(good))
    const res = await call([file('image/jpeg')])
    expect(res.status).toBe(200)
    expect((await res.json()).receipt.merchant).toBe('Spinneys')
  })

  it('bounds the upstream call with a timeout', async () => {
    h.fetch.mockResolvedValue(ok(good))
    await call([file('image/png')])
    expect(h.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('stops retrying once the shared deadline is nearly spent, so the reservation settles before the function is killed', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    h.fetch.mockImplementation(async () => {
      now += 30_000
      throw new Error('network')
    })
    expect((await call([file('image/jpeg')])).status).toBe(502)
    expect(h.fetch).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('rejects a payload over the platform body cap with a 413', async () => {
    expect((await call([file('image/jpeg', 4_100_000)])).status).toBe(413)
  })
})
