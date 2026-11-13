/**
 * The old banner removed items from local state without checking whether the
 * server call succeeded — failed confirms looked done but the DB row kept
 * awaiting_confirmation=true, so the card reappeared forever. These tests pin
 * the contract: actions resolve true ONLY when the backend accepted the change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetchAuth: vi.fn(),
}))

vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: mocks.apiFetchAuth }))

import { confirmSmsLog, dismissSmsLog } from '@/lib/sms/confirmActions'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('confirmSmsLog', () => {
  it('resolves true on 200 and posts the logId', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: true })
    await expect(confirmSmsLog('log-1')).resolves.toBe(true)
    const [url, init] = mocks.apiFetchAuth.mock.calls[0]
    expect(url).toBe('/api/sms/confirm')
    expect(JSON.parse(init.body)).toEqual({ logId: 'log-1' })
  })

  it('includes the currency for provisional confirmations', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: true })
    await confirmSmsLog('log-1', 'EGP')
    const [, init] = mocks.apiFetchAuth.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ logId: 'log-1', currency: 'EGP' })
  })

  it('resolves false on a non-ok response', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(confirmSmsLog('log-1')).resolves.toBe(false)
  })

  it('resolves false when the request throws', async () => {
    mocks.apiFetchAuth.mockRejectedValueOnce(new Error('offline'))
    await expect(confirmSmsLog('log-1')).resolves.toBe(false)
  })

  it('treats 404 not_found as already handled (double tap, retry after a lost response)', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ ok: false, reason: 'not_found' }) })
    await expect(confirmSmsLog('log-1')).resolves.toBe(true)
  })

  it('keeps a permanent 410 and any other 404 as a failure', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ ok: false, reason: 'raw_purged' }) })
    await expect(confirmSmsLog('log-1')).resolves.toBe(false)
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) })
    await expect(confirmSmsLog('log-1')).resolves.toBe(false)
  })
})

describe('dismissSmsLog (REG-3: clients cannot write sms_parse_log after 0231, so it goes through the server)', () => {
  it('posts the logId to /api/sms/dismiss and resolves true on 200', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: true })
    await expect(dismissSmsLog('log-2')).resolves.toBe(true)
    const [url, init] = mocks.apiFetchAuth.mock.calls[0]
    expect(url).toBe('/api/sms/dismiss')
    expect(JSON.parse(init.body)).toEqual({ logId: 'log-2' })
  })

  it('resolves false on a non-ok response (never throws)', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(dismissSmsLog('log-2')).resolves.toBe(false)
  })

  it('resolves false when the request throws', async () => {
    mocks.apiFetchAuth.mockRejectedValueOnce(new Error('network'))
    await expect(dismissSmsLog('log-2')).resolves.toBe(false)
  })

  it('treats 404 not_found as already handled', async () => {
    mocks.apiFetchAuth.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ ok: false, reason: 'not_found' }) })
    await expect(dismissSmsLog('log-2')).resolves.toBe(true)
  })
})
