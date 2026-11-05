import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ identity: vi.fn(), active: vi.fn() }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: h.identity }))
vi.mock('@/lib/auth/accountActive', () => ({ isAccountActive: h.active }))

import { resolveActiveApiUserId, resolveApiUserId } from './resolveApiUser'

describe('resolveActiveApiUserId', () => {
  beforeEach(() => {
    Object.values(h).forEach((m) => m.mockReset())
    h.identity.mockResolvedValue({ id: 'u1' })
  })
  it('returns the id of an active account', async () => {
    h.active.mockResolvedValue(true)
    expect(await resolveActiveApiUserId(new Request('http://x'))).toBe('u1')
  })
  it('refuses a suspended account that still holds a valid JWT', async () => {
    h.active.mockResolvedValue(false)
    expect(await resolveApiUserId(new Request('http://x'))).toBe('u1')
    expect(await resolveActiveApiUserId(new Request('http://x'))).toBeNull()
  })
  it('does not look the account up when nobody is signed in', async () => {
    h.identity.mockResolvedValue(null)
    expect(await resolveActiveApiUserId(new Request('http://x'))).toBeNull()
    expect(h.active).not.toHaveBeenCalled()
  })
})
