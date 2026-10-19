import { describe, expect, it } from 'vitest'
import { ADMIN_COOKIE, clearedSessionCookie, readSessionToken, sessionCookie } from './session'

const req = (headers: Record<string, string>) => new Request('https://buddget.app/api/admin/x', { headers })

describe('admin session transport', () => {
  it('reads the token from the header (native)', () => {
    expect(readSessionToken(req({ 'x-admin-session': 'tok123' }))).toBe('tok123')
  })

  it('reads the token from the cookie (web), among other cookies', () => {
    expect(readSessionToken(req({ cookie: `a=1; ${ADMIN_COOKIE}=abc_-def; b=2` }))).toBe('abc_-def')
  })

  it('prefers the header over the cookie', () => {
    expect(readSessionToken(req({ 'x-admin-session': 'h', cookie: `${ADMIN_COOKIE}=c` }))).toBe('h')
  })

  it('returns null without a token', () => {
    expect(readSessionToken(req({ cookie: 'other=1' }))).toBeNull()
  })

  it('issues an HttpOnly, SameSite=Strict cookie and clears it with Max-Age=0', () => {
    const set = sessionCookie('tok', new Date(Date.now() + 1000).toISOString())
    expect(set).toContain('HttpOnly')
    expect(set).toContain('SameSite=Strict')
    expect(clearedSessionCookie()).toContain('Max-Age=0')
  })
})
