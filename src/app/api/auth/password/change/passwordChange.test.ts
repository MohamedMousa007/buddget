import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ deleted: [] as string[], updateError: null as { message: string } | null }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => undefined, get: () => undefined }) }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({
  resolveVerifiedIdentity: async () => ({ id: 'u1', email: 'a@b.c', amr: [], sessionId: 's' }),
  resolveRouteUser: async () => ({ user: { id: 'u1' } }),
}))
vi.mock('@/lib/server/reauth', () => ({ verifyReauth: async () => 'ok', accessTokenOf: async () => 'tok' }))
vi.mock('@/lib/auth/resolveDeviceId', () => ({ resolveDeviceId: async () => 'dev-1234567890' }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (t: string) => ({ delete: () => ({ eq: () => { h.deleted.push(t); return Promise.resolve({ error: null }) } }), upsert: () => Promise.resolve({ error: null }), update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }), insert: () => Promise.resolve({ error: null }) }),
    auth: { admin: { updateUserById: async () => ({ error: h.updateError }), signOut: async () => ({ error: null }) } },
  }),
}))

import { POST } from '@/app/api/auth/password/change/route'

describe('auth/password/change: a same-password change is refused before bindings are cleared', () => {
  beforeEach(() => { h.deleted = []; h.updateError = null })
  it('same password answers 422 and clears nothing', async () => {
    h.updateError = { message: 'New password should be different from the old password.' }
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ newPassword: 'Same1234pw', currentPassword: 'Same1234pw' }) }))
    expect(res.status).toBe(422)
    expect(h.deleted).toEqual([])
  })

  it('recognises the Auth "different from the old password" refusal as 422', async () => {
    h.updateError = { message: 'New password should be different from the old password.' }
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ newPassword: 'Other1234pw', currentPassword: 'Same1234pw' }) }))
    expect(res.status).toBe(422)
  })
})
