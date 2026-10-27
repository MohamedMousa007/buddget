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

import { unbindBiometricOnSignOut } from './biometricAuth'
import { Preferences } from '@capacitor/preferences'

describe('unbindBiometricOnSignOut', () => {
  beforeEach(() => {
    apiFetchAuth.mockReset()
    vi.mocked(Preferences.get).mockImplementation((async ({ key }: { key: string }) => ({ value: key === 'buddget.biometric.enabled' ? '1' : null })) as never)
    vi.mocked(Preferences.remove).mockClear()
  })

  it('sends DELETE and clears the local enrolment', async () => {
    apiFetchAuth.mockResolvedValue({ ok: true, status: 200 })
    await unbindBiometricOnSignOut()
    expect(apiFetchAuth).toHaveBeenCalledWith('/api/biometric/register', { method: 'DELETE' })
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'buddget.biometric.enabled', value: '0' })
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'buddget.biometric.secret' })
  })
  it('skips the network when biometric was never enabled', async () => {
    vi.mocked(Preferences.get).mockImplementation((async () => ({ value: null })) as never)
    await unbindBiometricOnSignOut()
    expect(apiFetchAuth).not.toHaveBeenCalled()
  })
  it('still clears local state and resolves when the request fails', async () => {
    apiFetchAuth.mockRejectedValue(new Error('offline'))
    await expect(unbindBiometricOnSignOut()).resolves.toBeUndefined()
    expect(Preferences.remove).toHaveBeenCalledWith({ key: 'buddget.biometric.secret' })
  })
  it('never hangs: gives up on a stalled request after the timeout', async () => {
    vi.useFakeTimers()
    apiFetchAuth.mockReturnValue(new Promise(() => {}))
    const p = unbindBiometricOnSignOut()
    await vi.advanceTimersByTimeAsync(5000)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
