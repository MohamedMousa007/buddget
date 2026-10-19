import { afterEach, describe, expect, it } from 'vitest'
import { adminOriginFor, appHostFor, decideHostRoute } from './host'

const ADMIN = 'admin.buddget.app'
const decide = (host: string, pathname: string, search = '') => decideHostRoute({ host, pathname, search }, ADMIN)

describe('decideHostRoute', () => {
  it('serves the portal at the root of the admin host', () => {
    expect(decide(ADMIN, '/')).toEqual({ kind: 'rewrite', pathname: '/admin' })
  })

  it('lets the portal, its API, the auth callback and static assets through on the admin host', () => {
    for (const p of ['/admin', '/admin/accept', '/api/admin/auth/status', '/api/entitlements/me', '/auth/callback', '/_next/static/x.js', '/icons/a.png', '/favicon.ico', '/manifest.json']) {
      expect(decide(ADMIN, p), p).toEqual({ kind: 'next' })
    }
  })

  it('sends every other app route on the admin host to the app, keeping path and query', () => {
    expect(decide(ADMIN, '/dashboard', '?a=1')).toEqual({ kind: 'redirect', url: 'https://buddget.app/dashboard?a=1' })
    expect(decide(ADMIN, '/administrator')).toEqual({ kind: 'redirect', url: 'https://buddget.app/administrator' })
    expect(decide(ADMIN, '/auth/callbackx')).toMatchObject({ kind: 'redirect' })
  })

  it('moves /admin on the app host to the admin host', () => {
    expect(decide('buddget.app', '/admin')).toEqual({ kind: 'redirect', url: 'https://admin.buddget.app/' })
    expect(decide('buddget.app', '/admin', '?s=users')).toEqual({ kind: 'redirect', url: 'https://admin.buddget.app/?s=users' })
    expect(decide('buddget.app', '/admin/accept')).toEqual({ kind: 'redirect', url: 'https://admin.buddget.app/admin/accept' })
  })

  it('leaves the app host and its API alone', () => {
    expect(decide('buddget.app', '/')).toEqual({ kind: 'next' })
    expect(decide('buddget.app', '/api/admin/auth/status')).toEqual({ kind: 'next' })
    expect(decide('buddget.app', '/administrator')).toEqual({ kind: 'next' })
  })

  it('does nothing on localhost, previews or an unknown host, and ignores port and case', () => {
    expect(decide('localhost:3000', '/admin')).toEqual({ kind: 'next' })
    expect(decide('buddget-git-x.vercel.app', '/admin')).toEqual({ kind: 'next' })
    expect(decide('Admin.Buddget.app:443', '/')).toEqual({ kind: 'rewrite', pathname: '/admin' })
  })
})

describe('adminOriginFor', () => {
  const saved = process.env.NEXT_PUBLIC_ADMIN_HOST
  afterEach(() => { if (saved === undefined) delete process.env.NEXT_PUBLIC_ADMIN_HOST; else process.env.NEXT_PUBLIC_ADMIN_HOST = saved })

  it('points production links at the admin host and keeps dev origins', () => {
    delete process.env.NEXT_PUBLIC_ADMIN_HOST
    expect(adminOriginFor('https://buddget.app', ADMIN)).toBe('https://admin.buddget.app')
    expect(adminOriginFor('http://localhost:3000', ADMIN)).toBe('http://localhost:3000')
    expect(appHostFor(ADMIN)).toBe('buddget.app')
  })
})
