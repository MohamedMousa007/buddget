import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ revoked: vi.fn(), registered: vi.fn(), removedAny: vi.fn() }))
vi.mock('@/lib/server/devices/registry', () => ({ isRevokedDevice: h.revoked, hasAnyDevice: h.registered, hasRevokedDevice: h.removedAny }))

import { smsDeviceGate } from './deviceGate'

const svc = {} as never
const jwt = (deviceId: string | null) => ({ userId: 'u1', deviceId, viaJwt: true })

describe('smsDeviceGate', () => {
  beforeEach(() => {
    h.revoked.mockReset().mockResolvedValue(false)
    h.registered.mockReset().mockResolvedValue(true)
    h.removedAny.mockReset().mockResolvedValue(false)
    vi.stubEnv('SMS_REQUIRE_DEVICE_HEADER', '1')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('only logs a missing header while enforcement is off', async () => {
    vi.stubEnv('SMS_REQUIRE_DEVICE_HEADER', '')
    expect(await smsDeviceGate(svc, jwt(null))).toBeNull()
  })

  it('SST-5: refuses a header-less JWT call even with the flag off once the account has removed a phone', async () => {
    vi.stubEnv('SMS_REQUIRE_DEVICE_HEADER', '')
    h.removedAny.mockResolvedValue(true)
    const res = await smsDeviceGate(svc, jwt(null))
    expect(res?.status).toBe(403)
    expect(await res?.json()).toMatchObject({ error: 'device_required' })
    expect(await smsDeviceGate(svc, jwt('d1'))).toBeNull()
  })

  it('rejects a JWT call with no device header when the user has registered devices', async () => {
    const res = await smsDeviceGate(svc, jwt(null))
    expect(res?.status).toBe(403)
    expect(await res?.json()).toMatchObject({ error: 'device_required' })
  })

  it('allows a JWT call with no header when the user has no registered devices', async () => {
    expect(await smsDeviceGate(svc, jwt(null))).not.toBeNull()
    h.registered.mockResolvedValue(false)
    expect(await smsDeviceGate(svc, jwt(null))).toBeNull()
  })

  it('still rejects a revoked device id', async () => {
    h.revoked.mockResolvedValue(true)
    const res = await smsDeviceGate(svc, jwt('d1'))
    expect(res?.status).toBe(403)
  })

  it('passes a JWT call that sends a live device id', async () => {
    expect(await smsDeviceGate(svc, jwt('d1'))).toBeNull()
  })

  it('ignores the header requirement for ingest-token callers (device comes from the token row)', async () => {
    expect(await smsDeviceGate(svc, { userId: 'u1', deviceId: null, viaJwt: false })).toBeNull()
  })
})
