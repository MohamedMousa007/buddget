import { beforeEach, describe, expect, it, vi } from 'vitest'

const legacy = vi.hoisted(() => new Map<string, string>())
const secure = vi.hoisted(() => ({ value: null as string | null, available: true }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { legacy.set(key, value) }),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: legacy.get(key) ?? null })),
    remove: vi.fn(async ({ key }: { key: string }) => { legacy.delete(key) }),
  },
}))
vi.mock('@/lib/native/smsTracker', () => ({
  setSecureDeviceSecret: async (v: string) => { if (!secure.available) return false; secure.value = v; return true },
  getSecureDeviceSecret: async () => (secure.available ? secure.value : null),
  removeSecureDeviceSecret: async () => { secure.value = null; return true },
}))

import { Preferences } from '@capacitor/preferences'
import { clearDeviceSecret, deviceSecretHeader, rememberDeviceSecret } from './deviceSecret'

const SECRET = 'ab'.repeat(32)
const HEADER = { 'X-Buddget-Device-Secret': SECRET }

describe('device secret storage', () => {
  beforeEach(() => { legacy.clear(); secure.value = null; secure.available = true; vi.mocked(Preferences.set).mockClear() })

  it('no header until a secret was issued', async () => {
    expect(await deviceSecretHeader()).toEqual({})
  })
  it('keeps the issued secret in the secure store, never in Preferences', async () => {
    await rememberDeviceSecret({ deviceSecret: SECRET })
    expect(secure.value).toBe(SECRET)
    expect(Preferences.set).not.toHaveBeenCalled()
    expect(legacy.size).toBe(0)
    expect(await deviceSecretHeader()).toEqual(HEADER)
  })
  it('ignores a body without a well-formed secret (web, or an already-upgraded device)', async () => {
    await rememberDeviceSecret({})
    await rememberDeviceSecret({ deviceSecret: 'short' })
    await rememberDeviceSecret(null)
    expect(await deviceSecretHeader()).toEqual({})
  })
  it('clears it from both stores', async () => {
    await rememberDeviceSecret({ deviceSecret: SECRET })
    legacy.set('buddget_device_secret', SECRET)
    await clearDeviceSecret()
    expect(await deviceSecretHeader()).toEqual({})
    expect(secure.value).toBeNull()
    expect(legacy.size).toBe(0)
  })
  it('migrates a secret an older build left in Preferences, once, and removes the plaintext copy', async () => {
    legacy.set('buddget_device_secret', SECRET)
    expect(await deviceSecretHeader()).toEqual(HEADER)
    expect(secure.value).toBe(SECRET)
    expect(legacy.size).toBe(0)
    expect(await deviceSecretHeader()).toEqual(HEADER)
  })
  it('keeps the legacy copy (and still works) when the secure store is unavailable', async () => {
    secure.available = false
    legacy.set('buddget_device_secret', SECRET)
    expect(await deviceSecretHeader()).toEqual(HEADER)
    expect(legacy.get('buddget_device_secret')).toBe(SECRET)
  })
  it('stores nothing when the secure store is unavailable (next sign-in asks for the email code)', async () => {
    secure.available = false
    await rememberDeviceSecret({ deviceSecret: SECRET })
    expect(legacy.size).toBe(0)
    expect(await deviceSecretHeader()).toEqual({})
  })
})
