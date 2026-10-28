import { describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/app', () => ({ App: {} }))
vi.mock('@/lib/native/deviceId', () => ({ getOrCreateDeviceId: vi.fn(async () => null) }))

import { fingerprintDeviceId } from './init'

describe('fingerprintDeviceId', () => {
  it('reports a short one-way hash, never the id that backs biometric sign-in', async () => {
    const id = '3f2a9c1e-7b44-4d2a-9a10-5e6f7a8b9c0d'
    const tag = await fingerprintDeviceId(id)
    expect(tag).toMatch(/^[0-9a-f]{12}$/)
    expect(tag).not.toContain(id.slice(0, 8))
    expect(await fingerprintDeviceId(id)).toBe(tag)
  })
})
