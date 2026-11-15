import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const h = vi.hoisted(() => ({
  limited: vi.fn(),
  tokens: [] as Row[],
  inserts: 0,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/auth/resolveApiUser', () => ({ resolveActiveApiUserId: async () => 'u1' }))
vi.mock('@/lib/server/rateLimit', () => ({ isRateLimited: h.limited }))
vi.mock('@/lib/server/devices/registry', () => ({
  hasAnyDevice: async () => false,
  hasRevokedDevice: async () => false,
  isRevokedDevice: async () => false,
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = []
      let mode: 'select' | 'insert' | 'update' = 'select'
      let values: Row = {}
      let range: [number, number] | null = null
      const rows = () => {
        const hit = h.tokens.filter((r) => filters.every((f) => f(r))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        return range ? hit.slice(range[0], range[1] + 1) : hit
      }
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
        order: () => q,
        limit: () => q,
        range: (a: number, b: number) => ((range = [a, b]), q),
        insert: (v: Row) => ((mode = 'insert'), (values = v), q),
        update: (v: Row) => ((mode = 'update'), (values = v), q),
        delete: () => q,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => {
          h.inserts++
          const row = { id: `t${h.inserts}`, token: `tok-${h.inserts}`, is_active: true, created_at: `2026-11-0${h.inserts}`, ...values }
          h.tokens.push(row)
          return { data: row, error: null }
        },
        then: (resolve: (v: unknown) => void) => {
          if (mode === 'insert') {
            h.inserts++
            h.tokens.push({ id: `t${h.inserts}`, is_active: true, created_at: `2026-11-0${h.inserts}`, ...values })
            return resolve({ data: null, error: null })
          }
          const hit = rows()
          if (mode === 'update') hit.forEach((r) => Object.assign(r, values))
          resolve({ data: hit, error: null })
        },
      }
      return q
    },
  }),
}))

import { DELETE, GET } from './route'
import { hashIngestToken } from '@/lib/sms/ingestToken'

const get = () => GET(new Request('http://x/api/sms/setup-token'))

describe('GET /api/sms/setup-token', () => {
  beforeEach(() => {
    h.limited.mockReset().mockResolvedValue(false)
    h.tokens = []
    h.inserts = 0
  })

  it('limits creation per user per hour and fails closed', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(h.limited).toHaveBeenCalledWith(expect.anything(), 'sms-setup-token:u1', 3600, 60)
    expect(h.inserts).toBe(1)
  })

  it('answers 429 and writes nothing when limited', async () => {
    h.limited.mockResolvedValue(true)
    const res = await get()
    expect(res.status).toBe(429)
    expect(h.inserts).toBe(0)
  })

  it('issues a fresh token on every call and stores only its hash', async () => {
    const first = (await (await get()).json()) as { token: string }
    const second = (await (await get()).json()) as { token: string }
    expect(first.token).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.token).not.toBe(first.token)
    expect(h.tokens.map((t) => t.token_hash)).toEqual([hashIngestToken(first.token), hashIngestToken(second.token)])
    expect(JSON.stringify(h.tokens)).not.toContain(first.token)
    expect(h.tokens.every((t) => t.is_active)).toBe(true)
  })
})

describe('DELETE /api/sms/setup-token', () => {
  it('still rotates under its own limiter', async () => {
    h.limited.mockReset().mockResolvedValue(true)
    const res = await DELETE(new Request('http://x/api/sms/setup-token', { method: 'DELETE' }))
    expect(res.status).toBe(429)
  })
})
