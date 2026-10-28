import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ batch: vi.fn(), sweep: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/sms/harvest', () => ({ harvestBatch: h.batch }))
vi.mock('@/lib/sms/remaskStores', () => ({ sweepMaskedStores: h.sweep }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ upsert: async (row: unknown) => { h.upsert(row); return { error: null } } }) }) }))

import { GET } from './route'

const req = (auth?: string) => new Request('http://x/api/cron/sms-harvest', { headers: auth ? { authorization: auth } : {} })
const leaks = (rowsWithLeaks = 0) => ({ rowsScanned: 3, rowsWithLeaks, byKind: rowsWithLeaks ? { email: rowsWithLeaks } : {} })

describe('leak-scan stamp', () => {
  beforeEach(() => { process.env.CRON_SECRET = 's3cret'; h.batch.mockReset(); h.upsert.mockReset() })
  const run = async () => { h.batch.mockResolvedValue({ processed: 0, legacy: false, leaks: leaks() }); return (await GET(req('Bearer s3cret'))).json() }

  it('stamps only after a complete sweep with zero leaks', async () => {
    h.sweep.mockResolvedValue({ rowsScanned: 5, remasked: 2, rowsWithLeaks: 0, complete: true })
    expect((await run()).stamped).toBe(true)
    expect(h.upsert.mock.calls[0]![0]).toMatchObject({ key: 'sms_leak_scan_passed_at', value: expect.any(String) })
  })
  it('does not stamp an incomplete sweep and leaves the previous stamp alone', async () => {
    h.sweep.mockResolvedValue({ rowsScanned: 5, remasked: 0, rowsWithLeaks: 0, complete: false })
    expect((await run()).stamped).toBe(false)
    expect(h.upsert).not.toHaveBeenCalled()
  })
  it('clears the stamp when any leak is found', async () => {
    h.sweep.mockResolvedValue({ rowsScanned: 5, remasked: 0, rowsWithLeaks: 1, complete: true })
    expect((await run()).stamped).toBe(false)
    expect(h.upsert.mock.calls[0]![0]).toMatchObject({ value: null })
  })
})

describe('GET /api/cron/sms-harvest', () => {
  beforeEach(() => { process.env.CRON_SECRET = 's3cret'; h.batch.mockReset(); h.upsert.mockReset(); h.sweep.mockReset().mockResolvedValue({ rowsScanned: 5, remasked: 0, rowsWithLeaks: 0, complete: true }) })

  it('rejects an unauthorised caller', async () => {
    expect((await GET(req())).status).toBe(401)
    expect(h.batch).not.toHaveBeenCalled()
  })

  it('runs batches until one is empty and sums counts and the leak scan', async () => {
    h.batch.mockResolvedValueOnce({ processed: 3, legacy: false, leaks: leaks(1) }).mockResolvedValueOnce({ processed: 0, legacy: false, leaks: leaks() })
    const res = await GET(req('Bearer s3cret'))
    expect(await res.json()).toMatchObject({ ok: true, processed: 3, batches: 2, leaks: { rowsScanned: 6, rowsWithLeaks: 1, byKind: { email: 1 } } })
  })

  it('stops after the batch cap', async () => {
    h.batch.mockResolvedValue({ processed: 1, legacy: false, leaks: leaks() })
    const body = await (await GET(req('Bearer s3cret'))).json()
    expect(body.batches).toBe(5)
  })

  it('reports a failure as 500 with counts so far', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    h.batch.mockResolvedValueOnce({ processed: 2, legacy: false, leaks: leaks() }).mockRejectedValueOnce(new Error('x'))
    const res = await GET(req('Bearer s3cret'))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ ok: false, processed: 2 })
  })
})
