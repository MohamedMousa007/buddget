import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn(), clear: vi.fn(), remember: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: h.fetch }))
vi.mock('@/lib/native/biometricAuth', () => ({ clearLocalBiometric: h.clear }))
vi.mock('@/lib/native/deviceSecret', () => ({ rememberDeviceSecret: h.remember }))

import { changePassword } from '@/lib/auth/changePassword'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('REG-9: local biometric follows the server binding', () => {
  beforeEach(() => { h.fetch.mockReset(); h.clear.mockReset(); h.remember.mockReset() })

  it('is cleared on a full success', async () => {
    h.fetch.mockResolvedValue(reply(200, { ok: true }))
    expect(await changePassword({ newPassword: 'x' })).toBe('ok')
    expect(h.clear).toHaveBeenCalledTimes(1)
  })

  it('is cleared when the password changed but other sessions could not be revoked (502)', async () => {
    h.fetch.mockResolvedValue(reply(502, { code: 'sessions_not_revoked', passwordChanged: true }))
    expect(await changePassword({ newPassword: 'x' })).toBe('failed')
    expect(h.clear).toHaveBeenCalledTimes(1)
  })

  it('is kept when nothing changed', async () => {
    h.fetch.mockResolvedValue(reply(403, { code: 'wrong_password' }))
    expect(await changePassword({ newPassword: 'x' })).toBe('wrong_password')
    expect(h.clear).not.toHaveBeenCalled()
  })
})
