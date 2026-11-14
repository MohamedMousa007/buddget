import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: fetchMock }))
vi.mock('@/lib/native/isNative', () => ({ isNative: () => true, isIOS: () => true, isAndroid: () => false }))

import { setDeviceCollectsSms, readPendingSmsRole, resolveStartIntent } from '@/lib/devices/client'

beforeEach(() => {
  fetchMock.mockReset()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
})

describe('setDeviceCollectsSms', () => {
  it('stores the intended value when both tries fail, and clears it on success', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))
    expect(await setDeviceCollectsSms('a', false)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readPendingSmsRole('a')).toBe(false)

    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await setDeviceCollectsSms('a', false)).toBe(true)
    expect(readPendingSmsRole('a')).toBeNull()
  })

  it('treats a thrown request like a failure and succeeds on the second try', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    expect(await setDeviceCollectsSms('a', true)).toBe(true)
    expect(readPendingSmsRole('a')).toBeNull()
  })
})

describe('pending role ownership', () => {
  it("one account's unconfirmed write is ignored and cleared for another account", async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))
    await setDeviceCollectsSms('a', true)
    expect(readPendingSmsRole('b')).toBeNull()
    expect(readPendingSmsRole('a')).toBeNull()
  })
  it('an unparsable stored value counts as absent', () => {
    localStorage.setItem('sms.rolePending', 'true')
    expect(readPendingSmsRole('a')).toBeNull()
    expect(localStorage.getItem('sms.rolePending')).toBeNull()
  })
})

describe('resolveStartIntent', () => {
  it('a pending off beats a stale device row that says on', () => {
    expect(resolveStartIntent(false, true, true)).toBe(false)
  })
  it('falls back to the device row, then the account', () => {
    expect(resolveStartIntent(null, true, false)).toBe(true)
    expect(resolveStartIntent(null, null, false)).toBe(false)
    expect(resolveStartIntent(null, null, null)).toBeNull()
  })
})
