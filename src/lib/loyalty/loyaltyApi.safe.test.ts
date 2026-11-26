import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()
const configured = vi.fn(() => true)
vi.mock('@/lib/supabase/client', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/env', () => ({ isSupabaseConfigured: () => configured() }))

const api = await import('./loyaltyApi')

/** A client whose rpc reads `this`, as supabase-js does: a detached call would throw instead of resolving. */
const rpcReturning = (result: Promise<unknown>) => {
  const client = {
    rest: { result },
    rpc: vi.fn(function (this: { rest: { result: Promise<unknown> } } | undefined) { return this!.rest.result }),
  }
  return client
}

describe('loyalty RPCs fail quietly (uncaught "Missing NEXT_PUBLIC_SUPABASE_URL" on every screen)', () => {
  afterEach(() => { createClient.mockReset(); configured.mockReset(); configured.mockReturnValue(true) })

  it('fetchWeekSummary returns null without building a client when Supabase is not configured', async () => {
    configured.mockReturnValue(false)
    await expect(api.fetchWeekSummary()).resolves.toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('fetchWeekSummary returns null when building the client throws', async () => {
    createClient.mockImplementation(() => { throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL') })
    await expect(api.fetchWeekSummary()).resolves.toBeNull()
  })

  it('fetchWeekSummary returns null when the RPC rejects', async () => {
    createClient.mockReturnValue(rpcReturning(Promise.reject(new Error('offline'))))
    await expect(api.fetchWeekSummary()).resolves.toBeNull()
  })

  it('fetchWeekSummary returns the summary when the RPC succeeds', async () => {
    const summary = { thisWeek: '2026-11-23', streakWeeks: 2 }
    const client = rpcReturning(Promise.resolve({ data: summary, error: null }))
    createClient.mockReturnValue(client)
    await expect(api.fetchWeekSummary()).resolves.toEqual(summary)
    expect(client.rpc).toHaveBeenCalledWith('loyalty_week_summary', undefined)
  })

  it('the other loyalty calls report an error instead of throwing', async () => {
    createClient.mockImplementation(() => { throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL') })
    await expect(api.keepWeek('2026-11-23')).resolves.toEqual({ status: 'error' })
    await expect(api.buyShopItem('streak_freeze')).resolves.toEqual({ status: 'error' })
    await expect(api.applyCosmetic('card_finish', 'standard')).resolves.toBe('error')
    await expect(api.fetchCredits()).resolves.toEqual([])
    await expect(api.requestCreditName('Mo')).resolves.toBe('error')
  })

  it('keepWeek passes its argument through', async () => {
    const client = rpcReturning(Promise.resolve({ data: { status: 'already_kept' }, error: null }))
    createClient.mockReturnValue(client)
    await expect(api.keepWeek('2026-11-23')).resolves.toEqual({ status: 'already_kept' })
    expect(client.rpc).toHaveBeenCalledWith('loyalty_record_week_check', { p_week: '2026-11-23' })
  })
})
