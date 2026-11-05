import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapacitorApiOrigin, NATIVE_ALLOWED_HEADERS } from './nativeApiCors'

afterEach(() => vi.unstubAllEnvs())

describe('native API CORS', () => {
  it('always trusts the Capacitor shells', () => {
    expect(isCapacitorApiOrigin('https://localhost')).toBe(true)
    expect(isCapacitorApiOrigin('capacitor://localhost')).toBe(true)
  })

  it('trusts the local dev server only outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isCapacitorApiOrigin('http://localhost:3000')).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isCapacitorApiOrigin('http://localhost:3000')).toBe(false)
  })

  it('lets the native shell send the trusted-device secret header', () => {
    expect(NATIVE_ALLOWED_HEADERS).toContain('X-Buddget-Device-Secret')
  })

  it('never lets a cross-origin caller send the admin session header', () => {
    expect(NATIVE_ALLOWED_HEADERS).not.toContain('X-Admin-Session')
  })
})
