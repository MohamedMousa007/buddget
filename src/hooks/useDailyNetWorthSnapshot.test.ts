import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const configured = vi.fn(() => true)
vi.mock('@/lib/supabase/client', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/env', () => ({ isSupabaseConfigured: () => configured() }))
vi.mock('@/components/auth/auth-context', () => ({ useAuth: () => ({ user: null }) }))

const { saveNetWorthSnapshot } = await import('./useDailyNetWorthSnapshot')

const row = { user_id: 'u1', day: '2026-11-26', net_worth: 1000, currency: 'EGP', basis: 'accounts' as const }
const clientUpserting = (result: Promise<unknown>) => {
  const upsert = vi.fn(() => result)
  return { client: { from: vi.fn(() => ({ upsert })) }, upsert }
}

describe('saveNetWorthSnapshot (uncaught "Missing NEXT_PUBLIC_SUPABASE_URL" from the daily snapshot timer)', () => {
  afterEach(() => { createClient.mockReset(); configured.mockReset(); configured.mockReturnValue(true) })

  it('is false without building a client when Supabase is not configured', async () => {
    configured.mockReturnValue(false)
    await expect(saveNetWorthSnapshot(row)).resolves.toBe(false)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('is false when building the client throws', async () => {
    createClient.mockImplementation(() => { throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL') })
    await expect(saveNetWorthSnapshot(row)).resolves.toBe(false)
  })

  it('is false when the upsert rejects or returns an error', async () => {
    createClient.mockReturnValue(clientUpserting(Promise.reject(new Error('offline'))).client)
    await expect(saveNetWorthSnapshot(row)).resolves.toBe(false)
    createClient.mockReturnValue(clientUpserting(Promise.resolve({ error: { message: 'rls' } })).client)
    await expect(saveNetWorthSnapshot(row)).resolves.toBe(false)
  })

  it('upserts on the (user, day) key and is true when saved', async () => {
    const { client, upsert } = clientUpserting(Promise.resolve({ error: null }))
    createClient.mockReturnValue(client)
    await expect(saveNetWorthSnapshot(row)).resolves.toBe(true)
    expect(client.from).toHaveBeenCalledWith('net_worth_snapshots')
    expect(upsert).toHaveBeenCalledWith(row, { onConflict: 'user_id,day' })
  })
})
