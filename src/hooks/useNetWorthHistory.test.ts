import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const configured = vi.fn(() => true)
vi.mock('@/lib/supabase/client', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/env', () => ({ isSupabaseConfigured: () => configured() }))
vi.mock('@/components/auth/auth-context', () => ({ useAuth: () => ({ user: null }) }))

const { fetchNetWorthSnapshots } = await import('./useNetWorthHistory')

/** A query builder whose every step chains and whose await resolves to `result`. */
function builder(result: Promise<unknown>) {
  const q: Record<string, unknown> = {}
  for (const k of ['from', 'select', 'eq', 'gte', 'order']) q[k] = () => q
  q.limit = () => result
  return q
}

describe('fetchNetWorthSnapshots (Insights learning state crash)', () => {
  afterEach(() => { createClient.mockReset(); configured.mockReset(); configured.mockReturnValue(true) })

  it('returns [] without building a client when Supabase is not configured', async () => {
    configured.mockReturnValue(false)
    await expect(fetchNetWorthSnapshots('EGP', 'accounts', '2026-01-01')).resolves.toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns [] when building the client throws (the effect used to throw and crash the page)', async () => {
    createClient.mockImplementation(() => { throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL') })
    await expect(fetchNetWorthSnapshots('EGP', 'accounts', '2026-01-01')).resolves.toEqual([])
  })

  it('returns [] when the query rejects', async () => {
    createClient.mockReturnValue(builder(Promise.reject(new Error('offline'))))
    await expect(fetchNetWorthSnapshots('EGP', 'accounts', '2026-01-01')).resolves.toEqual([])
  })

  it('returns the rows when the read succeeds', async () => {
    const rows = [{ day: '2026-10-01', net_worth: 1000 }]
    createClient.mockReturnValue(builder(Promise.resolve({ data: rows, error: null })))
    await expect(fetchNetWorthSnapshots('EGP', 'accounts', '2026-01-01')).resolves.toEqual(rows)
  })
})
