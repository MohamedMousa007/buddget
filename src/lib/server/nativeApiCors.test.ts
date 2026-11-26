import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { isCapacitorApiOrigin, NATIVE_ALLOWED_HEADERS, nativeApiPreflightResponse, withNativeApiCors } from './nativeApiCors'

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

  it('allows the SMS event-id header: builds that still send it were refused at preflight, so queued SMS never left the phone', () => {
    expect(NATIVE_ALLOWED_HEADERS).toContain('X-Sms-Event-Id')
  })

  it('lets the native admin portal send its session header on admin routes, and nowhere else', () => {
    const preflight = (path: string, origin: string) => {
      const req = new NextRequest(`https://buddget.app${path}`, { method: 'OPTIONS', headers: { origin, 'access-control-request-headers': 'x-admin-session,x-requested-with' } })
      return nativeApiPreflightResponse(req)?.headers.get('Access-Control-Allow-Headers') ?? null
    }
    expect(preflight('/api/admin/auth/status', 'https://localhost')).toContain('X-Admin-Session')
    expect(preflight('/api/admin/auth/status', 'capacitor://localhost')).toContain('X-Admin-Session')
    expect(preflight('/api/admin/auth/status', 'https://localhost')).toContain('X-Requested-With')
    expect(preflight('/api/sms/parse', 'https://localhost')).not.toContain('X-Admin-Session')
    expect(preflight('/api/admin-ish', 'https://localhost')).not.toContain('X-Admin-Session')
    expect(preflight('/api/admin/auth/status', 'https://evil.example')).toBeNull()
    vi.stubEnv('NODE_ENV', 'production')
    expect(preflight('/api/admin/auth/status', 'http://localhost:3000')).toBeNull()
    expect(NATIVE_ALLOWED_HEADERS).not.toContain('X-Admin-Session')
  })

  it('lets the native shell read the grounding note on an AI response', () => {
    const req = new NextRequest('https://x/api/ai', { headers: { origin: 'https://localhost' } })
    expect(withNativeApiCors(req, NextResponse.json({})).headers.get('Access-Control-Expose-Headers')).toContain('X-Grounding')
  })
})
