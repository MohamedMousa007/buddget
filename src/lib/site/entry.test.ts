import { describe, expect, it } from 'vitest'
import { hasAuthCookie, isSitePath, pickSiteLocale, siteHomeRewrite } from './entry'

describe('site entry routing', () => {
  it('recognises website paths and nothing else', () => {
    expect(isSitePath('/en')).toBe(true)
    expect(isSitePath('/ar/features')).toBe(true)
    expect(isSitePath('/en/guides/emergency-fund-plan')).toBe(true)
    expect(isSitePath('/entries')).toBe(false)
    expect(isSitePath('/flow')).toBe(false)
    expect(isSitePath('/api/ar')).toBe(false)
  })

  it('detects a Supabase session cookie, chunked or not', () => {
    expect(hasAuthCookie(['sb-abc-auth-token'])).toBe(true)
    expect(hasAuthCookie(['x', 'sb-abc-auth-token.0'])).toBe(true)
    expect(hasAuthCookie(['sb-abc-auth-token-code-verifier'])).toBe(false)
    expect(hasAuthCookie([])).toBe(false)
  })

  it('defaults to Arabic and honours an English-first browser', () => {
    expect(pickSiteLocale(null)).toBe('ar')
    expect(pickSiteLocale('en-US,en;q=0.9')).toBe('en')
    expect(pickSiteLocale('ar-EG,ar;q=0.9,en;q=0.8')).toBe('ar')
    expect(pickSiteLocale('fr-FR')).toBe('ar')
  })

  it('shows the website at / only to people without a session', () => {
    expect(siteHomeRewrite({ pathname: '/', hasSession: false, acceptLanguage: 'en-GB' })).toBe('/en')
    expect(siteHomeRewrite({ pathname: '/', hasSession: true, acceptLanguage: 'en-GB' })).toBeNull()
    expect(siteHomeRewrite({ pathname: '/flow', hasSession: false, acceptLanguage: null })).toBeNull()
  })
})
