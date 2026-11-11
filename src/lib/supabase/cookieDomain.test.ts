import { describe, expect, it } from 'vitest'
import { authCookieOptions, COOKIE_DOMAIN_MARKER, domainCookieOptions, markerCookieOptions, parseCookiesPreferLast, planCookieDomain, supabaseCookieDomain } from './cookieDomain'

describe('supabaseCookieDomain', () => {
  it('shares the cookie across the app and admin hosts only', () => {
    expect(supabaseCookieDomain('buddget.app')).toBe('.buddget.app')
    expect(supabaseCookieDomain('admin.buddget.app')).toBe('.buddget.app')
    expect(supabaseCookieDomain('Admin.Buddget.app:443')).toBe('.buddget.app')
    expect(supabaseCookieDomain('localhost')).toBeUndefined()
    expect(supabaseCookieDomain('buddget-git-x.vercel.app')).toBeUndefined()
    expect(supabaseCookieDomain('evilbuddget.app')).toBeUndefined()
    expect(supabaseCookieDomain(null)).toBeUndefined()
  })
})

describe('parseCookiesPreferLast', () => {
  it('keeps the newest of a duplicated cookie (host-only is listed before the domain one)', () => {
    const got = parseCookiesPreferLast('a=1; sb-x-auth-token=old; b=2; sb-x-auth-token=new')
    expect(got.find((c) => c.name === 'sb-x-auth-token')?.value).toBe('new')
    expect(got).toHaveLength(3)
  })
})

describe('planCookieDomain', () => {
  const header = `sb-x-auth-token.0=aaa; sb-x-auth-token.1=bbb; other=1`

  it('does nothing without a shared domain (localhost, previews)', () => {
    expect(planCookieDomain({ domain: undefined, cookieHeader: header, written: ['sb-x-auth-token.0'] })).toEqual({ rewrite: [], expireHostOnly: [], markDone: false })
  })

  it('first visit after rollout: re-issues the auth cookie on the shared domain, expires the host-only one, marks done', () => {
    const plan = planCookieDomain({ domain: '.buddget.app', cookieHeader: header, written: [] })
    expect(plan.rewrite).toEqual([{ name: 'sb-x-auth-token.0', value: 'aaa' }, { name: 'sb-x-auth-token.1', value: 'bbb' }])
    expect(plan.expireHostOnly).toEqual(['sb-x-auth-token.0', 'sb-x-auth-token.1'])
    expect(plan.markDone).toBe(true)
  })

  it('does not rewrite what the response is writing anyway, but still expires its host-only twin', () => {
    const plan = planCookieDomain({ domain: '.buddget.app', cookieHeader: header, written: ['sb-x-auth-token.0'] })
    expect(plan.rewrite.map((c) => c.name)).toEqual(['sb-x-auth-token.1'])
    expect(plan.expireHostOnly).toEqual(expect.arrayContaining(['sb-x-auth-token.0', 'sb-x-auth-token.1']))
  })

  it('is a no-op once the host is marked as migrated', () => {
    const plan = planCookieDomain({ domain: '.buddget.app', cookieHeader: `${header}; ${COOKIE_DOMAIN_MARKER}=1`, written: [] })
    expect(plan).toEqual({ rewrite: [], expireHostOnly: [], markDone: false })
  })

  it('still expires the host-only twin of a refreshed token after migration', () => {
    const plan = planCookieDomain({ domain: '.buddget.app', cookieHeader: `${header}; ${COOKIE_DOMAIN_MARKER}=1`, written: ['sb-x-auth-token.0'] })
    expect(plan).toEqual({ rewrite: [], expireHostOnly: ['sb-x-auth-token.0'], markDone: false })
  })

  it('never touches visitors without an auth cookie', () => {
    expect(planCookieDomain({ domain: '.buddget.app', cookieHeader: 'other=1', written: [] })).toEqual({ rewrite: [], expireHostOnly: [], markDone: false })
  })

  it('uses the newest value when a duplicate already exists', () => {
    const plan = planCookieDomain({ domain: '.buddget.app', cookieHeader: 'sb-x-auth-token=stale; sb-x-auth-token=fresh', written: [] })
    expect(plan.rewrite).toEqual([{ name: 'sb-x-auth-token', value: 'fresh' }])
  })
})

describe('AUT-9 / SST-7: auth cookie flags', () => {
  it('the shared-domain and marker cookies are Secure', () => {
    expect(domainCookieOptions('.buddget.app').secure).toBe(true)
    expect(markerCookieOptions.secure).toBe(true)
  })

  it('the client options carry Secure with or without the shared domain and never HttpOnly (the browser client reads it)', () => {
    expect(authCookieOptions('.buddget.app', true)).toEqual({ domain: '.buddget.app', secure: true })
    expect(authCookieOptions(undefined, false)).toEqual({ secure: false })
    expect(authCookieOptions(undefined, true)).not.toHaveProperty('httpOnly')
  })
})

