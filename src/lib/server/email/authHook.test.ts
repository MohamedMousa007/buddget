import { describe, expect, it } from 'vitest'
import { planAuthEmails } from './authHook'

const URL = 'https://x.supabase.co'
const user = { id: 'u1', email: 'a@x.com' }
const base = { token: '123456', token_hash: 'H', redirect_to: 'https://buddget.app/auth/callback' }

describe('planAuthEmails', () => {
  it.each([
    ['signup', 'confirm_signup'],
    ['invite', 'invite_user'],
    ['magiclink', 'sign_in_code'],
    ['recovery', 'password_reset'],
    ['reauthentication', 'reauthentication'],
  ])('%s becomes %s with the code and a verify link', (type, key) => {
    const p = planAuthEmails({ user, email_data: { ...base, email_action_type: type } }, URL)
    expect(p).toMatchObject({ ok: true, emails: [{ key, to: 'a@x.com', vars: { code: '123456' } }] })
    if (p.ok) expect(p.emails[0]!.vars.link).toBe(`${URL}/auth/v1/verify?token=H&type=${type}&redirect_to=https%3A%2F%2Fbuddget.app%2Fauth%2Fcallback`)
  })
  it('sends two emails for a secure email change, pairing the codes crosswise', () => {
    const p = planAuthEmails({ user: { ...user, new_email: 'b@x.com' }, email_data: { ...base, email_action_type: 'email_change', token_new: '654321', token_hash_new: 'HN' } }, URL)
    if (!p.ok) throw new Error('expected a plan')
    expect(p.emails.map((e) => [e.to, e.vars.code])).toEqual([['a@x.com', '123456'], ['b@x.com', '654321']])
    expect(p.emails[0]!.vars.link).toContain('token=HN')
    expect(p.emails[1]!.vars.link).toContain('token=H&')
  })
  it('sends one email to the new address when the change needs a single confirmation', () => {
    const p = planAuthEmails({ user: { ...user, new_email: 'b@x.com' }, email_data: { ...base, email_action_type: 'email_change' } }, URL)
    expect(p).toMatchObject({ ok: true, emails: [{ to: 'b@x.com', vars: { new_email: 'b@x.com' } }] })
  })
  it('mails security notices, ignores the rest, and rejects unknown types', () => {
    expect(planAuthEmails({ user, email_data: { email_action_type: 'password_changed_notification' } }, URL)).toMatchObject({ ok: true, emails: [{ key: 'password_changed' }] })
    expect(planAuthEmails({ user, email_data: { email_action_type: 'email_changed_notification', old_email: 'o@x.com' } }, URL)).toMatchObject({ emails: [{ key: 'email_changed', to: 'o@x.com', vars: { old_email: 'o@x.com', new_email: 'a@x.com' } }] })
    expect(planAuthEmails({ user, email_data: { email_action_type: 'mfa_factor_enrolled_notification' } }, URL)).toEqual({ ok: false, ignored: true })
    expect(planAuthEmails({ user, email_data: { email_action_type: 'weird' } }, URL)).toMatchObject({ ok: false, error: expect.stringContaining('weird') })
  })
})
