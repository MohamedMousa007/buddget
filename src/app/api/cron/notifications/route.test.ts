import { beforeEach, describe, expect, it, vi } from 'vitest'

// S8C-07: the job reads in bulk per chunk of users; the number of queries must not grow with the number of users.
const h = vi.hoisted(() => ({ users: [] as string[], tables: [] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/cronAuth', () => ({ isAuthorizedCron: () => true }))
vi.mock('@/lib/notifications/deliveryWindow', () => ({ isDeliveryWindow: () => true, resolveUserTimeZone: () => 'Africa/Cairo' }))
vi.mock('@/lib/server/emitNotification', () => ({ emitNotification: async () => ({ created: false }) }))

const rowsFor = (table: string): Record<string, unknown>[] => {
  if (table === 'subscriptions') return h.users.map((u) => ({ id: `s-${u}`, user_id: u, status: 'active' }))
  if (table === 'goals') return h.users.map((u) => ({ id: `g-${u}`, user_id: u, status: 'active', linked_savings_account_ids: [`a-${u}`] }))
  if (table === 'expenses') return h.users.map((u) => ({ id: `e-${u}`, user_id: u, linked_subscription_id: `s-${u}`, expense_date: '2026-11-01' }))
  return []
}
function query(table: string): unknown {
  const q: Record<string, unknown> = {}
  const chain = new Proxy(q, {
    get: (_t, k) => {
      if (k === 'then') return (done: (r: unknown) => unknown) => Promise.resolve({ data: rowsFor(table), error: null }).then(done)
      if (k === 'maybeSingle') return async () => ({ data: null, error: null })
      return () => chain
    },
  })
  return chain
}
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => { h.tables.push(table); return query(table) },
    rpc: async (fn: string) => (fn === 'notification_due_users'
      ? { data: h.users.map((u) => ({ user_id: u, is_candidate: true, timezone: 'Africa/Cairo', month_start_day: 1, language: 'en' })), error: null }
      : { data: null, error: null }),
  }),
}))

import { GET } from './route'

async function readsFor(n: number): Promise<number> {
  h.users = Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  h.tables = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect((await GET(new Request('http://x/api/cron/notifications'))).status).toBe(200)
  return h.tables.length
}

beforeEach(() => vi.restoreAllMocks())

describe('GET /api/cron/notifications', () => {
  it('makes the same number of queries for 2 users as for 40 (no per-user reads)', async () => {
    expect(await readsFor(40)).toBe(await readsFor(2))
  })
})
