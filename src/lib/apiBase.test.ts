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

  it('still targets the remote API from other hosts (native shells)', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
    expect(apiUrl('/api/foo')).toBe('https://buddget.app/api/foo')
    expect(usesRemoteApi()).toBe(true)
  })
})
