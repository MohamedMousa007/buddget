import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl, usesRemoteApi } from './apiBase'

describe('apiUrl on the admin host', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://buddget.app')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('keeps calls relative on the admin host so they stay same-origin', () => {
    vi.stubGlobal('window', { location: { hostname: 'admin.buddget.app' } })
    expect(apiUrl('/api/admin/auth/status')).toBe('/api/admin/auth/status')
    expect(usesRemoteApi()).toBe(false)
  })

  it('keeps calls relative on the product and marketing hosts, whatever the build env says', () => {
    for (const hostname of ['my.buddget.app', 'buddget.app']) {
      vi.stubGlobal('window', { location: { hostname } })
      expect(apiUrl('/api/account/delete')).toBe('/api/account/delete')
      expect(usesRemoteApi()).toBe(false)
    }
  })

  it('still targets the remote API from other hosts (native shells)', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
    expect(apiUrl('/api/foo')).toBe('https://buddget.app/api/foo')
    expect(usesRemoteApi()).toBe(true)
  })
})

describe('appOrigin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('prefers the app URL over the API base so auth redirects land on the product host', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://my.buddget.app')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://buddget.app')
    const { appOrigin } = await import('./apiBase')
    expect(appOrigin()).toBe('https://my.buddget.app')
  })
})
