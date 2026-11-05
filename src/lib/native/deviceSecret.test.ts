import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, string>())
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value) }),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    remove: vi.fn(async ({ key }: { key: string }) => { store.delete(key) }),
  },
}))

import { clearDeviceSecret, deviceSecretHeader, rememberDeviceSecret } from './deviceSecret'

const SECRET = 'ab'.repeat(32)

describe('device secret storage', () => {
  beforeEach(() => store.clear())

  it('no header until a secret was issued', async () => {
    expect(await deviceSecretHeader()).toEqual({})
  })
  it('keeps the issued secret and sends it as the header', async () => {
    await rememberDeviceSecret({ deviceSecret: SECRET })
    expect(await deviceSecretHeader()).toEqual({ 'X-Buddget-Device-Secret': SECRET })
  })
  it('ignores a body without a well-formed secret (web, or an already-upgraded device)', async () => {
    await rememberDeviceSecret({})
    await rememberDeviceSecret({ deviceSecret: 'short' })
    await rememberDeviceSecret(null)
    expect(await deviceSecretHeader()).toEqual({})
  })
  it('clears it', async () => {
    await rememberDeviceSecret({ deviceSecret: SECRET })
    await clearDeviceSecret()
    expect(await deviceSecretHeader()).toEqual({})
  })
})
