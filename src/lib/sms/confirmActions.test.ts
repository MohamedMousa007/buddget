/**
 * The old banner removed items from local state without checking whether the
 * server call succeeded — failed confirms looked done but the DB row kept
 * awaiting_confirmation=true, so the card reappeared forever. These tests pin
 * the contract: actions resolve true ONLY when the backend accepted the change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiFetchAuth: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: mocks.apiFetchAuth }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: (values: unknown) => ({
        eq: (col: string, val: string) => mocks.update(values, col, val),
      }),
    }),
  }),
}))

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
})

describe('dismissSmsLog', () => {
  it('resolves true when the update succeeds', async () => {
    mocks.update.mockResolvedValueOnce({ error: null })
    await expect(dismissSmsLog('log-2')).resolves.toBe(true)
    expect(mocks.update).toHaveBeenCalledWith({ awaiting_confirmation: false }, 'id', 'log-2')
  })

  it('resolves false when supabase returns an error (never throws)', async () => {
    mocks.update.mockResolvedValueOnce({ error: { message: 'RLS denied' } })
    await expect(dismissSmsLog('log-2')).resolves.toBe(false)
  })

  it('resolves false when the client throws', async () => {
    mocks.update.mockRejectedValueOnce(new Error('network'))
    await expect(dismissSmsLog('log-2')).resolves.toBe(false)
  })
})
