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

  const post = () => {
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(10)], 'a.mp4', { type: 'audio/mp4' }))
    return POST(new Request('http://x', { method: 'POST', body: form }) as never)
  }

  it('returns empty text when Whisper echoes the prompt on silence', async () => {
    h.create.mockResolvedValue({ text: 'Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi' })
    expect(await (await post()).json()).toMatchObject({ text: '' })
  })

  it('returns empty text when every segment is no-speech', async () => {
    h.create.mockResolvedValue({ text: 'spent 250 EGP', segments: [{ no_speech_prob: 0.95 }] })
    expect(await (await post()).json()).toMatchObject({ text: '' })
  })

  it('lets Whisper auto-detect the language and carries no concrete expense example in the prompt', async () => {
    h.create.mockResolvedValue({ text: 'دفعت خمسين جنيه في الكافيه' })
    await post()
    const args = h.create.mock.calls[0][0]
    expect(args).not.toHaveProperty('language')
    expect(args.prompt).not.toMatch(/spent 250|Formats expected/)
  })
})
