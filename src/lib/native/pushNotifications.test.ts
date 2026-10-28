import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/native/isNative', () => ({ isNative: () => true, getPlatform: () => 'android', isIOS: () => false }))
vi.mock('@/lib/native/deviceId', () => ({ getOrCreateDeviceId: async () => 'dev1' }))
vi.mock('@/lib/apiBase', () => ({ apiUrl: (p: string) => p }))
const getSession = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession } }) }))

import { postPushToken } from './pushNotifications'

const args = { accessToken: 'stale', userId: 'u1' }
const authOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization

describe('postPushToken', () => {
  beforeEach(() => {
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: { access_token: 'fresh' } } })
  })

  it('sends the current session token, not the one captured at registration', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', f)
    expect(await postPushToken('tok', args, { delayMs: 0 })).toBe(true)
    expect(authOf(f.mock.calls[0])).toBe('Bearer fresh')
  })

  it('retries a failed post and rereads the token each time', async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', f)
    expect(await postPushToken('tok', args, { delayMs: 0 })).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('gives up after the attempts and reports failure', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', f)
    expect(await postPushToken('tok', args, { delayMs: 0 })).toBe(false)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('does not retry a rejected token (400)', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 400 })
    vi.stubGlobal('fetch', f)
    expect(await postPushToken('tok', args, { delayMs: 0 })).toBe(false)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
