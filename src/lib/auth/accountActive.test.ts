import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserById = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ auth: { admin: { getUserById } } }) }))

import { ACCOUNT_ACTIVE_TTL_MS, isAccountActive, resetAccountActiveCache } from './accountActive'

const NOW = 1_700_000_000_000
const iso = (ms: number) => new Date(ms).toISOString()

describe('isAccountActive', () => {
  beforeEach(() => { getUserById.mockReset(); resetAccountActiveCache() })

  it('is true for a normal account and asks Auth once per minute', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', banned_until: null } }, error: null })
    expect(await isAccountActive('u1', NOW)).toBe(true)
    expect(await isAccountActive('u1', NOW + ACCOUNT_ACTIVE_TTL_MS - 1)).toBe(true)
    expect(getUserById).toHaveBeenCalledTimes(1)
    await isAccountActive('u1', NOW + ACCOUNT_ACTIVE_TTL_MS + 1)
    expect(getUserById).toHaveBeenCalledTimes(2)
  })

  it('refuses a suspended account, and picks up the suspension within the TTL', async () => {
    getUserById.mockResolvedValueOnce({ data: { user: { id: 'u1', banned_until: null } }, error: null })
    expect(await isAccountActive('u1', NOW)).toBe(true)
    getUserById.mockResolvedValueOnce({ data: { user: { id: 'u1', banned_until: iso(NOW + 86_400_000) } }, error: null })
    expect(await isAccountActive('u1', NOW + ACCOUNT_ACTIVE_TTL_MS + 1)).toBe(false)
  })

  it('an expired ban no longer blocks', async () => {
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', banned_until: iso(NOW - 1000) } }, error: null })
    expect(await isAccountActive('u1', NOW)).toBe(true)
  })

  it('refuses a deleted account', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404, code: 'user_not_found' } })
    expect(await isAccountActive('u1', NOW)).toBe(false)
  })

  it('fails open on an Auth outage and does not cache it', async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { status: 500, code: 'unexpected_failure' } })
    expect(await isAccountActive('u1', NOW)).toBe(true)
    getUserById.mockRejectedValue(new Error('network'))
    expect(await isAccountActive('u1', NOW + 1)).toBe(true)
    expect(getUserById).toHaveBeenCalledTimes(2)
  })
})
