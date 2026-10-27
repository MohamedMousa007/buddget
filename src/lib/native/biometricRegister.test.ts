import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchAuth = vi.fn()
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: (...a: unknown[]) => apiFetchAuth(...a) }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: { set: vi.fn(async () => {}), get: vi.fn(async () => ({ value: null })), remove: vi.fn(async () => {}) },
}))
vi.mock('@/lib/native/isNative', () => ({ isNative: () => true }))

import { registerBiometric } from './biometricAuth'

describe('registerBiometric', () => {
  beforeEach(() => apiFetchAuth.mockReset())

  it('reports ok on success', async () => {
    apiFetchAuth.mockResolvedValue({ ok: true, status: 200 })
    expect(await registerBiometric('a@b.c')).toBe('ok')
  })
  it('reports a conflict when another account owns the device (409)', async () => {
    apiFetchAuth.mockResolvedValue({ ok: false, status: 409 })
    expect(await registerBiometric('a@b.c')).toBe('conflict')
  })
  it('reports error on other failures', async () => {
    apiFetchAuth.mockResolvedValue({ ok: false, status: 500 })
    expect(await registerBiometric('a@b.c')).toBe('error')
  })
})
