import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ otp: vi.fn(), invite: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithOtp: h.otp } }) }))
vi.mock('@/lib/supabase/env', () => ({ requireSupabaseUrl: () => 'http://x', requireSupabasePublishableKey: () => 'k' }))
vi.mock('@/lib/apiBase', () => ({ appOrigin: () => 'https://buddget.app' }))

import { sendStaffInviteEmail } from './inviteEmail'
import { accountHasPassword } from './credentials'

const service = { auth: { admin: { inviteUserByEmail: h.invite } } } as never

describe('sendStaffInviteEmail', () => {
  beforeEach(() => { h.otp.mockReset(); h.invite.mockReset() })

  it('invites new accounts with a link that lands on the portal', async () => {
    h.invite.mockResolvedValue({ error: null })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(true)
    expect(h.invite).toHaveBeenCalledWith('a@x.com', { redirectTo: 'https://buddget.app/auth/callback?next=%2Fadmin' })
    expect(h.otp).not.toHaveBeenCalled()
  })

  it('sends a magic link to people who already have an account, without creating one', async () => {
    h.invite.mockResolvedValue({ error: { code: 'email_exists', status: 422, message: 'exists' } })
    h.otp.mockResolvedValue({ error: null })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(true)
    expect(h.otp).toHaveBeenCalledWith({ email: 'a@x.com', options: { emailRedirectTo: 'https://buddget.app/auth/callback?next=%2Fadmin', shouldCreateUser: false } })
  })

  it('reports failure when the mailer errors', async () => {
    h.invite.mockResolvedValue({ error: { code: 'unexpected_failure', status: 500, message: 'smtp' } })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
    h.invite.mockResolvedValue({ error: { code: 'email_exists', status: 422, message: 'exists' } })
    h.otp.mockResolvedValue({ error: { message: 'rate' } })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
  })
})

describe('accountHasPassword', () => {
  const emailUser = { identities: [{ provider: 'email' }] } as unknown as User
  it('asks for the account password only from people who set one themselves', () => {
    expect(accountHasPassword(emailUser, false)).toBe(true)
    expect(accountHasPassword(emailUser, true)).toBe(false)
    expect(accountHasPassword({ identities: [{ provider: 'google' }] } as unknown as User, false)).toBe(false)
  })
})
