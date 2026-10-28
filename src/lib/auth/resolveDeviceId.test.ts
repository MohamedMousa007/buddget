import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/deviceCookie', () => ({ readDeviceCookie: async () => 'cookie-device-0000', setDeviceCookie: async () => undefined }))

import { resolveDeviceId } from './resolveDeviceId'

const req = (id?: string) => new Request('http://x', { headers: id ? { 'X-Buddget-Device-Id': id } : {} })

describe('resolveDeviceId', () => {
  it('accepts a well-formed header', async () => {
    expect(await resolveDeviceId(req('3f2a9c1e-7b44-4d2a-9a10-5e6f7a8b9c0d'))).toBe('3f2a9c1e-7b44-4d2a-9a10-5e6f7a8b9c0d')
  })

  it('ignores a header that is too long, too short or not an id, so rate-limit keys cannot be minted at will', async () => {
    for (const bad of ['a'.repeat(200), 'abc', 'not a device id!!!!', "'; drop table--"]) {
      expect(await resolveDeviceId(req(bad))).toBe('cookie-device-0000')
    }
  })

  it('falls back to the cookie without a header', async () => {
    expect(await resolveDeviceId(req())).toBe('cookie-device-0000')
  })
})
