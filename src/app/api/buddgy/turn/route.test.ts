import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ reserve: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/server/ai/auth', () => ({ requireAiUser: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/server/ai/quota', () => ({ reserveAiQuota: h.reserve, settleAiQuota: vi.fn(), quotaDeniedResponse: () => new Response(null, { status: 429 }) }))

import { POST } from './route'

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
