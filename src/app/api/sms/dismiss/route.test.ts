import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; user_id: string; awaiting_confirmation: boolean }
const h = vi.hoisted(() => ({ rows: [] as Row[], uid: 'u1' as string | null, gate: null as Response | null }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: async () => h.uid }))
vi.mock('@/lib/sms/deviceGate', () => ({ smsDeviceGate: async () => h.gate }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const filters: Array<(r: Row) => boolean> = []
      const q = {
        update: (patch: Partial<Row>) => ({
          eq: function eq(k: keyof Row, v: unknown) {
            filters.push((r) => r[k] === v)
            return Object.assign(Promise.resolve(), {
              eq,
              select: async () => {
                const hit = h.rows.filter((r) => filters.every((f) => f(r)))
                hit.forEach((r) => Object.assign(r, patch))
                return { data: hit.map((r) => ({ id: r.id })), error: null }
              },
            })
          },
        }),
      }
      return q
    },
  }),
}))

import { POST } from './route'

const ID = '11111111-1111-4111-8111-111111111111'
const call = (body: unknown) => POST(new Request('http://x/api/sms/dismiss', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  h.uid = 'u1'
  h.gate = null
  h.rows = [{ id: ID, user_id: 'u1', awaiting_confirmation: true }, { id: '22222222-2222-4222-8222-222222222222', user_id: 'u2', awaiting_confirmation: true }]
})

describe('POST /api/sms/dismiss', () => {
  it('clears awaiting_confirmation on the caller own row', async () => {
    expect((await call({ logId: ID })).status).toBe(200)
    expect(h.rows[0]!.awaiting_confirmation).toBe(false)
  })

  it('cannot dismiss another user row', async () => {
    const res = await call({ logId: '22222222-2222-4222-8222-222222222222' })
    expect(res.status).toBe(404)
    expect(h.rows[1]!.awaiting_confirmation).toBe(true)
  })

  it('answers 404 for a row that is not awaiting confirmation any more', async () => {
    h.rows[0]!.awaiting_confirmation = false
    expect((await call({ logId: ID })).status).toBe(404)
  })

  it('rejects unauthenticated callers, a bad body and a removed phone', async () => {
    h.uid = null
    expect((await call({ logId: ID })).status).toBe(401)
    h.uid = 'u1'
    expect((await call({ logId: 'nope' })).status).toBe(400)
    h.gate = new Response(null, { status: 403 })
    expect((await call({ logId: ID })).status).toBe(403)
    expect(h.rows[0]!.awaiting_confirmation).toBe(true)
  })
})
