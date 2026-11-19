import { beforeEach, describe, expect, it, vi } from 'vitest'

const legacy = vi.hoisted(() => new Map<string, string>())
const secure = vi.hoisted(() => ({ items: new Map<string, string>(), available: true }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { legacy.set(key, value) }),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: legacy.get(key) ?? null })),
    remove: vi.fn(async ({ key }: { key: string }) => { legacy.delete(key) }),
  },
}))
vi.mock('@/lib/native/smsTracker', () => ({
  setSecureItem: async (key: string, value: string) => { if (!secure.available) return false; secure.items.set(key, value); return true },
  getSecureItem: async (key: string) => (secure.available ? secure.items.get(key) ?? null : null),
  removeSecureItem: async (key: string) => { secure.items.delete(key); return true },
}))

import { Preferences } from '@capacitor/preferences'
import { readSecureItem, removeSecureItem, writeSecureItem } from './secureItem'

const KEY = 'biometric_secret' as const
const LEGACY = 'buddget.biometric.secret'
const SECRET = 'cd'.repeat(32)

describe('secure item storage', () => {
  beforeEach(() => { legacy.clear(); secure.items.clear(); secure.available = true; vi.mocked(Preferences.set).mockClear() })

  it('writes to the secure store, never to Preferences', async () => {
    expect(await writeSecureItem(KEY, LEGACY, SECRET)).toBe(true)
    expect(secure.items.get(KEY)).toBe(SECRET)
    expect(Preferences.set).not.toHaveBeenCalled()
    expect(await readSecureItem(KEY, LEGACY)).toBe(SECRET)
  })
  it('reports failure and keeps nothing in plain storage when the secure store is unavailable', async () => {
    secure.available = false
    expect(await writeSecureItem(KEY, LEGACY, SECRET)).toBe(false)
    expect(legacy.size).toBe(0)
  })
  it('migrates a value an older build left in Preferences, once, and removes the plaintext copy', async () => {
    legacy.set(LEGACY, SECRET)
    expect(await readSecureItem(KEY, LEGACY)).toBe(SECRET)
    expect(secure.items.get(KEY)).toBe(SECRET)
    expect(legacy.size).toBe(0)
    expect(await readSecureItem(KEY, LEGACY)).toBe(SECRET)
  })
  it('keeps the legacy copy (and still returns it) when the secure store is unavailable', async () => {
    secure.available = false
    legacy.set(LEGACY, SECRET)
    expect(await readSecureItem(KEY, LEGACY)).toBe(SECRET)
    expect(legacy.get(LEGACY)).toBe(SECRET)
  })
  it('removes it from both stores', async () => {
    await writeSecureItem(KEY, LEGACY, SECRET)
    legacy.set(LEGACY, SECRET)
    await removeSecureItem(KEY, LEGACY)
    expect(await readSecureItem(KEY, LEGACY)).toBeNull()
    expect(legacy.size).toBe(0)
  })
})
