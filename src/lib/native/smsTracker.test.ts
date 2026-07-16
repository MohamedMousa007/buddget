/**
 * Tests for the SMS native-token contract (BUD test-user regression).
 *
 * Key bug covered: the short-lived Supabase JWT must NEVER be written to
 * native storage. Only the non-expiring sms_ingest_token may reach
 * plugin.saveToken — a stored JWT expires in ~1h and every later SMS POST
 * 401s and is silently dropped by SmsForwardWorker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  saveToken: vi.fn(() => Promise.resolve()),
  setEnabled: vi.fn(() => Promise.resolve()),
  getStatus: vi.fn(() => Promise.resolve({ enabled: true, tokenSaved: true, setupCompleted: true, permission: true })),
  peekPendingQueue: vi.fn(() => Promise.resolve({ items: [] as unknown[] })),
  removePending: vi.fn(() => Promise.resolve()),
  fetch: vi.fn<typeof globalThis.fetch>(),
}))

vi.mock('@/lib/native/isNative', () => ({
  isNative: vi.fn(() => true),
  isAndroid: vi.fn(() => true),
}))

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({
    saveToken: mocks.saveToken,
    setEnabled: mocks.setEnabled,
    getStatus: mocks.getStatus,
    peekPendingQueue: mocks.peekPendingQueue,
    removePending: mocks.removePending,
  })),
}))

vi.mock('@/lib/apiBase', () => ({
  apiUrl: (path: string) => `https://app.test${path}`,
}))

type SmsTrackerModule = typeof import('@/lib/native/smsTracker')

async function freshModule(): Promise<SmsTrackerModule> {
  vi.resetModules()
  return import('@/lib/native/smsTracker')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('ensureIngestToken', () => {
  it('stores the ingest token returned by setup-token, never the JWT', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ token: 'ingest-abc' }), { status: 200 }),
    )
    const sms = await freshModule()
    const ok = await sms.ensureIngestToken('jwt-SHOULD-NEVER-BE-STORED')
    expect(ok).toBe(true)
    expect(mocks.saveToken).toHaveBeenCalledTimes(1)
    expect(mocks.saveToken.mock.calls[0][0]).toMatchObject({ token: 'ingest-abc' })
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
    const promise = sms.ensureIngestToken('jwt')
    await vi.runAllTimersAsync()
    expect(await promise).toBe(false)
    expect(mocks.saveToken).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledTimes(3) // retried
    vi.useRealTimers()
  })

  it('gives up immediately on 401 (retrying a bad session is pointless)', async () => {
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 401 }))
    const sms = await freshModule()
    expect(await sms.ensureIngestToken('expired-jwt')).toBe(false)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.saveToken).not.toHaveBeenCalled()
  })

  it('no-ops without a session token', async () => {
    const sms = await freshModule()
    expect(await sms.ensureIngestToken('')).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.saveToken).not.toHaveBeenCalled()
  })
})

describe('drainAndSubmitPendingSms', () => {
  const items = [
    { message: 'txn 1', sender: 'CIB', receivedAt: '2026-07-01T00:00:00Z', source: 'sms' },
    { message: 'txn 2', sender: 'NBE', receivedAt: '2026-07-01T00:01:00Z', source: 'sms' },
    { message: 'txn 3', sender: 'HSBC', receivedAt: '2026-07-01T00:02:00Z', source: 'sms' },
  ]

  it('removes only delivered/permanently-rejected items; transient failures stay queued', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // txn 1 delivered
      .mockResolvedValueOnce(new Response('{}', { status: 503 })) // txn 2 transient — stays
      .mockResolvedValueOnce(new Response('{}', { status: 400 })) // txn 3 permanent reject — removed
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt')
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
    expect(mocks.removePending).toHaveBeenCalledTimes(1)
    expect(mocks.removePending.mock.calls[0][0]).toEqual({ items: [items[0], items[2]] })
  })

  it('stops on auth failure without touching the queue (every item would 401)', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 401 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt')
    expect(mocks.fetch).toHaveBeenCalledTimes(1) // bailed after the first 401
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('keeps everything queued when the network drops mid-drain', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items })
    mocks.fetch
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new TypeError('offline'))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt')
    expect(mocks.fetch).toHaveBeenCalledTimes(2) // stopped after the network error
    // The one delivered item is still removed; the rest survive on device.
    expect(mocks.removePending).toHaveBeenCalledWith({ items: [items[0]] })
  })

  it('does nothing when the queue is empty', async () => {
    mocks.peekPendingQueue.mockResolvedValue({ items: [] })
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.removePending).not.toHaveBeenCalled()
  })

  it('replays the SMS arrival time, not the drain time', async () => {
    // A queued SMS can post days after it arrived. Without receivedAt the server
    // stamps its own clock, filing the expense under the drain date and skewing
    // the pairing window that merges two-leg transfers.
    mocks.peekPendingQueue.mockResolvedValue({ items: [items[0]] })
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }))
    const sms = await freshModule()
    await sms.drainAndSubmitPendingSms('jwt')
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
    await sms.saveSmsToken('ingest-xyz')
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
