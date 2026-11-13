/**
 * Tests for the SMS native-token contract (BUD test-user regression).
 *
 * Key bug covered: the short-lived Supabase JWT must NEVER be written to
 * native storage. Only the non-expiring sms_ingest_token may reach
 * plugin.saveToken — a stored JWT expires in ~1h and every later SMS POST
 * 401s and is silently dropped by SmsForwardWorker.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { SmsCapacitorPlugin } from '@/lib/native/smsTracker'

const mocks = vi.hoisted(() => ({
  saveToken: vi.fn() as Mock<SmsCapacitorPlugin['saveToken']>,
  setEnabled: vi.fn() as Mock<SmsCapacitorPlugin['setEnabled']>,
  clearCredentials: vi.fn() as Mock<SmsCapacitorPlugin['clearCredentials']>,
  getStatus: vi.fn() as Mock<SmsCapacitorPlugin['getStatus']>,
  peekPendingQueue: vi.fn() as Mock<SmsCapacitorPlugin['peekPendingQueue']>,
  removePending: vi.fn() as Mock<SmsCapacitorPlugin['removePending']>,
  fetch: vi.fn() as Mock<typeof globalThis.fetch>,
}))

vi.mock('@/lib/native/isNative', () => ({
  isNative: vi.fn(() => true),
  isAndroid: vi.fn(() => true),
}))

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({
    saveToken: mocks.saveToken,
    setEnabled: mocks.setEnabled,
    clearCredentials: mocks.clearCredentials,
    getStatus: mocks.getStatus,
    peekPendingQueue: mocks.peekPendingQueue,
    removePending: mocks.removePending,
  })),
}))

vi.mock('@/lib/apiBase', () => ({
  apiUrl: (path: string) => `https://buddget.app${path}`,
  apiFetchAuth: (path: string, init?: RequestInit) => globalThis.fetch(`https://buddget.app${path}`, init),
}))

type SmsTrackerModule = typeof import('@/lib/native/smsTracker')

async function freshModule(): Promise<SmsTrackerModule> {
  vi.resetModules()
  return import('@/lib/native/smsTracker')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-02T00:00:00Z'))
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('ensureIngestToken', () => {
  it('stores the ingest token returned by setup-token, never the JWT', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ token: 'ingest-abc' }), { status: 200 }),
    )
    const sms = await freshModule()
    const ok = await sms.ensureIngestToken('jwt-SHOULD-NEVER-BE-STORED', 'user-1')
    expect(ok).toBe(true)
    expect(mocks.saveToken).toHaveBeenCalledTimes(1)
    expect(mocks.saveToken.mock.calls[0][0]).toMatchObject({ token: 'ingest-abc', userId: 'user-1' })
    // The JWT is only allowed in the Authorization header of the fetch.
    const fetchInit = mocks.fetch.mock.calls[0][1] as RequestInit
    expect((fetchInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer jwt-SHOULD-NEVER-BE-STORED',
    )
  })

  it('never writes anything on fetch failure (stale ingest token stays valid)', async () => {
    vi.useFakeTimers()
    mocks.fetch.mockRejectedValue(new TypeError('network down'))
    const sms = await freshModule()
    const promise = sms.ensureIngestToken('jwt', 'user-1')
    await vi.runAllTimersAsync()
    expect(await promise).toBe(false)
    expect(mocks.saveToken).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(3) // retried
    vi.useRealTimers()
  })

  it('gives up immediately on 401 (retrying a bad session is pointless)', async () => {
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 401 }))
    const sms = await freshModule()
    expect(await sms.ensureIngestToken('expired-jwt', 'user-1')).toBe(false)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.saveToken).not.toHaveBeenCalled()
  })

  it('no-ops without a session token or a user id', async () => {
    const sms = await freshModule()
    expect(await sms.ensureIngestToken('', 'user-1')).toBe(false)
    expect(await sms.ensureIngestToken('jwt', '')).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.saveToken).not.toHaveBeenCalled()
  })
})

describe('reconcileSmsOwner (account switch)', () => {
  it('drops the stored token when it belongs to another account', async () => {
    mocks.getStatus.mockResolvedValue({ enabled: true, tokenSaved: true, setupCompleted: true, wired: true, tokenUserId: 'user-A', permission: true })
    const sms = await freshModule()
    await sms.reconcileSmsOwner('user-B')
    expect(mocks.clearCredentials).toHaveBeenCalledTimes(1)
  })

  it('keeps the token when the same account signs back in', async () => {
    mocks.getStatus.mockResolvedValue({ enabled: true, tokenSaved: true, setupCompleted: true, wired: true, tokenUserId: 'user-A', permission: true })
    const sms = await freshModule()
    await sms.reconcileSmsOwner('user-A')
    expect(mocks.clearCredentials).not.toHaveBeenCalled()
  })

  it('does nothing when no token is stored', async () => {
    mocks.getStatus.mockResolvedValue({ enabled: false, tokenSaved: false, setupCompleted: false, wired: false, tokenUserId: '', permission: true })
    const sms = await freshModule()
    await sms.reconcileSmsOwner('user-B')
    expect(mocks.clearCredentials).not.toHaveBeenCalled()
  })

  it('drops a legacy token with no owner stamp (unknown ownership → re-establish)', async () => {
    mocks.getStatus.mockResolvedValue({ enabled: true, tokenSaved: true, setupCompleted: true, wired: true, tokenUserId: '', permission: true })
    const sms = await freshModule()
    await sms.reconcileSmsOwner('user-B')
    expect(mocks.clearCredentials).toHaveBeenCalledTimes(1)
  })
})

describe('drainAndSubmitPendingSms', () => {
  const items = [
    { message: 'txn 1', sender: 'CIB', receivedAt: '2026-07-01T00:00:00Z', source: 'sms' },
    { message: 'txn 2', sender: 'NBE', receivedAt: '2026-07-01T00:01:00Z', source: 'sms' },
    { message: 'txn 3', sender: 'HSBC', receivedAt: '2026-07-01T00:02:00Z', source: 'sms' },
  ]

  it('removes only items the server accepted; every refusal stays queued', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // txn 1 delivered
      .mockResolvedValueOnce(new Response('{"error":"Invalid body"}', { status: 400 })) // txn 2 refused: parked, run continues
      .mockResolvedValueOnce(new Response('{}', { status: 503 })) // txn 3 transient: parked, run stops
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
    expect(mocks.removePending).toHaveBeenCalledTimes(1)
    expect(mocks.removePending.mock.calls[0][0]).toEqual({ items: [items[0]] })
    expect(sms.getLastDrainOutcome()).toBe('http_503')
  })

  it('never deletes a refused message, however often it is refused, and parks it on a schedule', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items: [items[0]] })
    mocks.fetch.mockImplementation(async () => new Response('{}', { status: 422 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    await sms.drainAndSubmitPendingSms('jwt', 'user-1') // not due yet: no second request
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 7 * 3600_000)
    await sms.drainAndSubmitPendingSms('jwt', 'user-1') // due again
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    for (let i = 0; i < 20; i++) await sms.drainAndSubmitPendingSms('jwt', 'user-1', { force: true })
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('a tap (force) retries immediately, ignoring the schedule, but not more than once per cooldown', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items: [items[0]] })
    mocks.fetch.mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    await sms.drainAndSubmitPendingSms('jwt', 'user-1', { force: true })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.removePending).toHaveBeenCalledWith({ items: [items[0]] })
    await sms.drainAndSubmitPendingSms('jwt', 'user-1', { force: true }) // inside the cooldown
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('stops on auth failure without touching the queue (every item would 401)', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 401 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    expect(mocks.fetch).toHaveBeenCalledTimes(1) // bailed after the first 401
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('keeps everything queued when the network drops mid-drain', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new TypeError('offline'))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    expect(mocks.fetch).toHaveBeenCalledTimes(2) // stopped after the network error
    // The one delivered item is still removed; the rest survive on device.
    expect(mocks.removePending).toHaveBeenCalledWith({ items: [items[0]] })
  })

  it('sends the per-SMS eventId in the body only (a custom header is refused by CORS preflight), and a claim-in-progress answer never deletes the item', async () => {
    const withId = { ...items[0], eventId: 'evt-1' }
    mocks.peekPendingQueue.mockResolvedValue({ items: [withId, { ...items[1], eventId: 'evt-2' }, { ...items[2], eventId: 'evt-3' }] })
    mocks.fetch
      .mockResolvedValueOnce(new Response('{"retry":true}', { status: 409 }))
      .mockResolvedValueOnce(new Response('{}', { status: 202 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    const init = mocks.fetch.mock.calls[0][1] as RequestInit
    expect(Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase())).not.toContain('x-sms-event-id')
    expect(JSON.parse(init.body as string).eventId).toBe('evt-1')
    expect(mocks.removePending).toHaveBeenCalledTimes(1)
    expect(mocks.removePending.mock.calls[0][0].items.map((i) => i.eventId)).toEqual(['evt-3'])
  })

  it('does not overlap two drains', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items: [items[0]] })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await Promise.all([sms.drainAndSubmitPendingSms('jwt', 'user-1'), sms.drainAndSubmitPendingSms('jwt', 'user-1')])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('truncates a >2000 char message to 2000 and flags it', async () => {
    const sms = await freshModule()
    const out = sms.buildSmsPayload({ ...items[0], message: 'x'.repeat(2500) })
    expect(out.message).toHaveLength(2000)
    expect(out.truncated).toBe(true)
    expect(sms.buildSmsPayload(items[0])).toBe(items[0])
  })

  it('does nothing when the queue is empty', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items: [] })
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('never forwards SMS owned by another account (leaves them queued)', async () => {
    // The security fix: an SMS captured under user-A must NOT be POSTed with
    // user-B's session — it would land in the wrong account. Legacy items
    // (no owner stamp) still deliver to the current user.
    mocks.peekPendingQueue.mockResolvedValue({ items: [
      { message: 'mine', sender: 'CIB', receivedAt: '2026-07-01T00:00:00Z', source: 'sms', userId: 'user-B' },
      { message: 'theirs', sender: 'NBE', receivedAt: '2026-07-01T00:01:00Z', source: 'sms', userId: 'user-A' },
      { message: 'legacy', sender: 'HSBC', receivedAt: '2026-07-01T00:02:00Z', source: 'sms' },
    ] })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-B')
    // Only user-B's item + the legacy item are posted; user-A's is skipped.
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    const bodies = mocks.fetch.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).message)
    expect(bodies).toEqual(['mine', 'legacy'])
  })

  it('replays the SMS arrival time, not the drain time', async () => {
    // A queued SMS can post days after it arrived. Without receivedAt the server
    // stamps its own clock, filing the expense under the drain date and skewing
    // the pairing window that merges two-leg transfers.
    mocks.peekPendingQueue.mockResolvedValue({ items: [items[0]] })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt', 'user-1')
    const init = mocks.fetch.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'txn 1',
      sender: 'CIB',
      receivedAt: '2026-07-01T00:00:00Z',
      source: 'sms',
    })
  })
})

describe('token-write surface', () => {
  it('saveSmsToken is the only exported function that persists a token', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ token: 'ingest-xyz' }), { status: 200 }),
    )
    const sms = await freshModule()
    await sms.saveSmsToken('ingest-xyz', 'user-1')
    await sms.setSmsEnabled(true)
    await sms.stopSMSTracking()
    // Exactly one write, from saveSmsToken, with the ingest token.
    expect(mocks.saveToken).toHaveBeenCalledTimes(1)
    expect(mocks.saveToken.mock.calls[0][0]).toMatchObject({ token: 'ingest-xyz' })
    // The legacy JWT-writing entry points are gone.
    expect('startSMSTracking' in sms).toBe(false)
    expect('resumeSmsTrackingIfEnabled' in sms).toBe(false)
    expect('refreshSmsToken' in sms).toBe(false)
  })
})

describe('SST-2 saveSmsToken base URL', () => {
  it('does not hand the token to the plugin when the API base is outside the allow-list', async () => {
    vi.doMock('@/lib/apiBase', () => ({ apiUrl: (path: string) => `https://evil.example${path}` }))
    vi.resetModules()
    const fresh = await import('@/lib/native/smsTracker')
    await fresh.saveSmsToken('ingest-xyz', 'user-1')
    expect(mocks.saveToken).not.toHaveBeenCalled()
    expect(fresh.getSmsNativeError()).toMatch(/not allowed/)
    vi.doUnmock('@/lib/apiBase')
  })
})

describe('native error state', () => {
  it('surfaces a failing plugin call and clears on the next success', async () => {
    mocks.setEnabled.mockRejectedValueOnce(new Error('keystore locked'))
    const sms = await freshModule()
    await sms.setSmsEnabled(true)
    expect(sms.getSmsNativeError()).toBe('setEnabled: keystore locked')
    mocks.setEnabled.mockResolvedValueOnce(undefined)
    await sms.setSmsEnabled(true)
    expect(sms.getSmsNativeError()).toBeNull()
  })
})
