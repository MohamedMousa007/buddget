import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchAuth = vi.fn()
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: (...a: unknown[]) => apiFetchAuth(...a) }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: { set: vi.fn(async () => {}), get: vi.fn(async () => ({ value: null })), remove: vi.fn(async () => {}) },
}))
vi.mock('@/lib/native/isNative', () => ({ isNative: () => true }))

import { registerBiometric } from './biometricAuth'

describe('registerBiometric', () => {
  beforeEach(() => { apiFetchAuth.mockReset(); vi.mocked(Preferences.set).mockClear() })

  it('reports ok on success', async () => {
    apiFetchAuth.mockResolvedValue({ ok: true, status: 200 })
    expect(await registerBiometric('a@b.c')).toBe('ok')
  })
  it('reports a conflict when another account owns the device (409)', async () => {
    apiFetchAuth.mockResolvedValue({ ok: false, status: 409 })
    expect(await registerBiometric('a@b.c')).toBe('conflict')
  })
  it('reports reauth_required when the server wants a recent sign-in (typed 403)', async () => {
    apiFetchAuth.mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: 'reauth_required' }) })
    expect(await registerBiometric('a@b.c')).toBe('reauth_required')
    expect(Preferences.set).not.toHaveBeenCalled()
  })
  it('retries with the password as the reauth proof', async () => {
    apiFetchAuth.mockResolvedValue({ ok: true, status: 200 })
    expect(await registerBiometric('a@b.c', 'pw')).toBe('ok')
    expect(JSON.parse(apiFetchAuth.mock.calls[0][1].body)).toMatchObject({ currentPassword: 'pw' })
  })
  it('does not send a password key when none was typed', async () => {
    apiFetchAuth.mockResolvedValue({ ok: true, status: 200 })
    await registerBiometric('a@b.c')
    expect(JSON.parse(apiFetchAuth.mock.calls[0][1].body)).not.toHaveProperty('currentPassword')
  })
  it('maps wrong_password and 429', async () => {
    apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: 'wrong_password' }) })
    expect(await registerBiometric('a@b.c', 'x')).toBe('wrong_password')
    apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 429 })
    expect(await registerBiometric('a@b.c', 'x')).toBe('rate_limited')
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
