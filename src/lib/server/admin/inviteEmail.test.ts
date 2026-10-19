import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ gen: vi.fn(), send: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/apiBase', () => ({ appOrigin: () => 'https://buddget.app' }))
vi.mock('@/lib/server/email/send', () => ({ sendTemplatedEmail: h.send }))

import { sendStaffInviteEmail } from './inviteEmail'

const service = { auth: { admin: { generateLink: h.gen } } } as never
const REDIRECT = 'https://admin.buddget.app/auth/callback?next=%2Fadmin'
const link = (url: string) => ({ data: { properties: { action_link: url } }, error: null })

describe('sendStaffInviteEmail', () => {
  beforeEach(() => {
    h.gen.mockReset()
    h.send.mockReset()
    h.send.mockResolvedValue({ ok: true, providerId: 'p', locale: 'en' })
  })

  it('mints an invite link for a new account and mails it through the templated sender', async () => {
    h.gen.mockResolvedValue(link('https://x.supabase.co/verify?t=1'))
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(true)
    expect(h.gen).toHaveBeenCalledWith({ type: 'invite', email: 'a@x.com', options: { redirectTo: REDIRECT } })
    expect(h.send).toHaveBeenCalledWith('invite_admin', { email: 'a@x.com' }, { link: 'https://x.supabase.co/verify?t=1', inviter_name: undefined, role: undefined }, { service, source: 'admin' })
  })

  it('gives an existing account the same invite, with a sign-in link underneath', async () => {
    h.gen
      .mockResolvedValueOnce({ data: null, error: { code: 'email_exists', status: 422, message: 'exists' } })
      .mockResolvedValueOnce(link('https://x.supabase.co/verify?t=2'))
    expect(await sendStaffInviteEmail(service, 'a@x.com', { inviterName: 'Mo' })).toBe(true)
    expect(h.gen).toHaveBeenLastCalledWith({ type: 'magiclink', email: 'a@x.com', options: { redirectTo: REDIRECT } })
    expect(h.send.mock.calls[0][2]).toMatchObject({ link: 'https://x.supabase.co/verify?t=2', inviter_name: 'Mo' })
  })

  it('reports failure when the link fails or the send is rejected', async () => {
    h.gen.mockResolvedValue({ data: null, error: { code: 'unexpected_failure', status: 500, message: 'boom' } })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
    expect(h.send).not.toHaveBeenCalled()
    h.gen.mockResolvedValue(link('u'))
    h.send.mockResolvedValue({ ok: false, error: 'Resend 403' })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
  })
})
