import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ ctor: vi.fn(), create: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: async () => ({ id: 'u1', email: null, amr: [] }) }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: async () => ({ allowed: true }),
  settleAiQuota: async () => undefined,
  quotaDeniedResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('groq-sdk', () => ({
  default: class {
    audio = { transcriptions: { create: h.create } }
    constructor(opts: unknown) {
      h.ctor(opts)
    }
  },
}))

import { POST } from './route'

describe('POST /api/voice/transcribe', () => {
  beforeEach(() => {
    h.ctor.mockReset()
    h.create.mockReset().mockResolvedValue({ text: 'hi' })
    vi.stubEnv('GROQ_API_KEY', 'k')
  })

  it('bounds the Groq call so a hung upstream cannot hold the quota reservation', async () => {
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(10)], 'a.mp4', { type: 'audio/mp4' }))
    expect((await POST(new Request('http://x', { method: 'POST', body: form }) as never)).status).toBe(200)
    expect(h.ctor).toHaveBeenCalledWith(expect.objectContaining({ timeout: expect.any(Number) }))
  })
})
