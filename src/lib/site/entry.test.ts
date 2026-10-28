import { describe, expect, it } from 'vitest'
import { decideSiteRoute, hasAuthCookie, isSitePath, pickSiteLocale, siteHomeRewrite, splitHosts } from './entry'

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

describe('two-host mode', () => {
  const split = { marketing: 'buddget.app', app: 'my.buddget.app' }
  const base = { search: '', hasSession: false, acceptLanguage: null as string | null, split }

  it('is off unless the app host is configured', () => {
    expect(splitHosts({})).toBeNull()
    expect(splitHosts({ my: 'My.Buddget.app' })).toEqual({ marketing: 'buddget.app', app: 'my.buddget.app' })
    expect(splitHosts({ my: 'app.example.com', marketing: 'example.com' })).toEqual({ marketing: 'example.com', app: 'app.example.com' })
  })

  it('keeps the old cookie rule when not split', () => {
    expect(decideSiteRoute({ ...base, split: null, host: 'localhost', pathname: '/' })).toEqual({ kind: 'rewrite', pathname: '/ar' })
    expect(decideSiteRoute({ ...base, split: null, host: 'localhost', pathname: '/', hasSession: true })).toEqual({ kind: 'next' })
  })

  it('serves the website at the root domain, whoever is signed in', () => {
    expect(decideSiteRoute({ ...base, host: 'buddget.app', pathname: '/', hasSession: true, acceptLanguage: 'en-US' })).toEqual({ kind: 'rewrite', pathname: '/en' })
    expect(decideSiteRoute({ ...base, host: 'buddget.app', pathname: '/ar/features' })).toEqual({ kind: 'next' })
  })

  it('keeps shared endpoints and legal pages on the root domain', () => {
    for (const p of ['/api/site/lead', '/api/sms/parse', '/auth/callback', '/legal/privacy', '/privacy', '/robots.txt', '/_next/static/x.js', '/site/screens/flow.webp']) {
      expect(decideSiteRoute({ ...base, host: 'buddget.app', pathname: p }), p).toEqual({ kind: 'next' })
    }
  })

  it('sends app routes on the root domain to the app host, keeping path and query', () => {
    expect(decideSiteRoute({ ...base, host: 'buddget.app', pathname: '/flow', search: '?a=1' })).toEqual({ kind: 'redirect', url: 'https://my.buddget.app/flow?a=1' })
  })

  it('sends www to the root domain and website paths on the app host back to it', () => {
    expect(decideSiteRoute({ ...base, host: 'www.buddget.app', pathname: '/en/pricing' })).toEqual({ kind: 'redirect', url: 'https://buddget.app/en/pricing' })
    expect(decideSiteRoute({ ...base, host: 'my.buddget.app', pathname: '/en/pricing' })).toEqual({ kind: 'redirect', url: 'https://buddget.app/en/pricing' })
  })

  it('serves the app at its own host and closes it to crawlers', () => {
    expect(decideSiteRoute({ ...base, host: 'my.buddget.app', pathname: '/' })).toEqual({ kind: 'next' })
    expect(decideSiteRoute({ ...base, host: 'my.buddget.app', pathname: '/robots.txt' })).toEqual({ kind: 'robots-closed' })
  })

  it('leaves other hosts alone', () => {
    expect(decideSiteRoute({ ...base, host: 'admin.buddget.app', pathname: '/flow' })).toEqual({ kind: 'next' })
    expect(decideSiteRoute({ ...base, host: 'preview-x.vercel.app', pathname: '/' })).toEqual({ kind: 'next' })
  })
})
