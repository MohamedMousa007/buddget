import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ ctor: vi.fn(), create: vi.fn(), settle: vi.fn(), reserve: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: async () => ({ id: 'u1', email: null, amr: [] }) }))
vi.mock('@/lib/server/ai/quota', () => ({
  reserveAiQuota: h.reserve,
  settleAiQuota: h.settle,
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
    h.reserve.mockReset().mockResolvedValue({ allowed: true })
    h.settle.mockReset().mockResolvedValue(undefined)
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

  it('rejects by content-length before reading the body', async () => {
    const req = new Request('http://x', { method: 'POST', headers: { 'content-length': '9000000' }, body: new FormData() })
    const form = vi.spyOn(req, 'formData')
    expect((await POST(req as never)).status).toBe(413)
    expect(form).not.toHaveBeenCalled()
  })

  it('settles by the audio duration Whisper reports, not zero or bytes', async () => {
    h.create.mockResolvedValue({ text: 'hi', duration: 12.5 })
    await post()
    expect(h.settle.mock.calls[0][1].usage.promptTokens).toBe(1250)
  })

  it('falls back to a bytes-per-second estimate when no duration comes back, and reserves on the same scale', async () => {
    await post()
    expect(h.reserve.mock.calls[0][0].estUnits).toBe(1)
    expect(h.settle.mock.calls[0][1].usage.promptTokens).toBe(1)
  })
})
