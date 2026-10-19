import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ gen: vi.fn(), fetch: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/apiBase', () => ({ appOrigin: () => 'https://buddget.app' }))
vi.stubGlobal('fetch', h.fetch)

import { sendStaffInviteEmail } from './inviteEmail'

const service = { auth: { admin: { generateLink: h.gen } } } as never
const REDIRECT = 'https://admin.buddget.app/auth/callback?next=%2Fadmin'
const link = (url: string) => ({ data: { properties: { action_link: url } }, error: null })

describe('sendStaffInviteEmail', () => {
  beforeEach(() => {
    h.gen.mockReset()
    h.fetch.mockReset()
    h.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
    process.env.RESEND_API_KEY = 're_test'
  })

  it('mints an invite link for a new account and mails it from our mailer', async () => {
    h.gen.mockResolvedValue(link('https://x.supabase.co/verify?t=1'))
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(true)
    expect(h.gen).toHaveBeenCalledWith({ type: 'invite', email: 'a@x.com', options: { redirectTo: REDIRECT } })
    const body = JSON.parse(h.fetch.mock.calls[0][1].body)
    expect(body.to).toEqual(['a@x.com'])
    expect(body.html).toContain('https://x.supabase.co/verify?t=1')
  })

  it('gives an existing account the same invite, with a sign-in link underneath', async () => {
    h.gen
      .mockResolvedValueOnce({ data: null, error: { code: 'email_exists', status: 422, message: 'exists' } })
      .mockResolvedValueOnce(link('https://x.supabase.co/verify?t=2'))
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(true)
    expect(h.gen).toHaveBeenLastCalledWith({ type: 'magiclink', email: 'a@x.com', options: { redirectTo: REDIRECT } })
    expect(JSON.parse(h.fetch.mock.calls[0][1].body).subject).toMatch(/admin portal/i)
  })

  it('reports failure when the mailer is missing, the link fails or the send is rejected', async () => {
    delete process.env.RESEND_API_KEY
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
    process.env.RESEND_API_KEY = 're_test'
    h.gen.mockResolvedValue({ data: null, error: { code: 'unexpected_failure', status: 500, message: 'boom' } })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
    h.gen.mockResolvedValue(link('u'))
    h.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'domain not verified' })
    expect(await sendStaffInviteEmail(service, 'a@x.com')).toBe(false)
  })
})
