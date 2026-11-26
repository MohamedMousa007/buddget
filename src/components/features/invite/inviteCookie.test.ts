import { describe, expect, it } from 'vitest'
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, inviteCodeFromPath, inviteCookieFor } from './inviteCookie'
import { INVITE_COOKIE as FROM_INVITE_CODE, normalizeInviteCode } from './inviteCode'

describe('the proxy keeps an invite link\'s code from the server (QA R11: a tap before hydration lost it)', () => {
  it('reads the code from /i/<code>, normalised, with or without a trailing slash', () => {
    expect(inviteCodeFromPath('/i/layla-7k2')).toBe('LAYLA-7K2')
    expect(inviteCodeFromPath('/i/LAYLA-7K2/')).toBe('LAYLA-7K2')
    expect(inviteCodeFromPath('/i/layla%2D7k2')).toBe('LAYLA-7K2')
  })

  it('ignores other paths and links that cannot be a code', () => {
    for (const p of ['/flow', '/i', '/i/', '/i/!!', '/i/layla-7k2/extra', '/x/i/layla-7k2', '/i/%E0%A4%A']) expect(inviteCodeFromPath(p)).toBeNull()
  })

  it('writes the same 30-day Lax cookie the page writes, Secure only on https, readable by the page script', () => {
    expect(inviteCookieFor('/i/layla-7k2', true)).toEqual({
      name: 'buddget_invite',
      value: 'LAYLA-7K2',
      options: { maxAge: 2_592_000, path: '/', sameSite: 'lax', secure: true, httpOnly: false },
    })
    expect(inviteCookieFor('/i/layla-7k2', false)?.options.secure).toBe(false)
    expect(inviteCookieFor('/flow', true)).toBeNull()
    expect(INVITE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30)
  })

  it('inviteCode keeps exporting the same name and normaliser', () => {
    expect(FROM_INVITE_CODE).toBe(INVITE_COOKIE)
    expect(normalizeInviteCode(' ab-7k2 ')).toBe('AB-7K2')
  })
})
