import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ audit: vi.fn(), exportData: vi.fn(), order: [] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/admin/guard', () => ({
  guardAdmin: async () => ({
    ok: true,
    ctx: {
      staff: { id: 's1' },
      audit: h.audit,
      service: {
        rpc: async () => ({ data: true }),
        auth: { admin: { getUserById: async () => ({ data: { user: { email: 'a@example.invalid', created_at: 'x' } } }) } },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      },
    },
  }),
  bad: (error: string, status = 400) => Response.json({ error }, { status }),
  json: (b: unknown, status = 200) => Response.json(b, { status }),
  readJson: async (req: Request) => req.json(),
}))
vi.mock('@/lib/server/admin/stepUp', () => ({ STEP_UP_ERROR: 'step', stepUp: async () => true }))
vi.mock('@/lib/server/admin/financialAccess', () => ({ hasFinancialGrant: async () => true }))
vi.mock('@/lib/server/userData', () => ({ exportUserData: h.exportData }))

import { POST } from './route'

const ID = '11111111-1111-4111-8111-111111111111'
const call = () => POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'Data subject request from the user' }) }), { params: Promise.resolve({ id: ID }) })

beforeEach(() => {
  h.order.length = 0
  h.audit.mockReset().mockImplementation(async () => { h.order.push('audit'); return true })
  h.exportData.mockReset().mockImplementation(async () => { h.order.push('export'); return { tables: {}, failed: [] } })
})

describe('SLG-5 DSR export audit', () => {
  it('writes the audit row before reading any data', async () => {
    expect((await call()).status).toBe(200)
    expect(h.order).toEqual(['audit', 'export'])
  })

  it('releases nothing when the audit row cannot be written', async () => {
    h.audit.mockResolvedValue(false)
    const res = await call()
    expect(res.status).toBe(503)
    expect(h.exportData).not.toHaveBeenCalled()
  })
})
