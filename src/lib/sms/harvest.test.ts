import { describe, expect, it, vi } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { harvestBatch, harvestLegacySms, MASKER_VERSION, scanMaskedBodies } from './harvest'

type Row = Record<string, unknown>
const BODY = 'Purchase of 120.50 EGP at Test Shop card ending 1234 available balance 5000.00'

function makeService(opts: { rows: Row[]; selectError?: { code: string }; updateError?: { code: string } }) {
  const updates: Array<{ values: Row; id: unknown }> = []
  const inserts: Row[][] = []
  const selects: string[] = []
  const service = {
    from: (table: string) => {
      if (table === 'sms_stats_outbox') return { insert: async (v: Row[]) => { inserts.push(v); return { error: null } } }
      const q: Record<string, unknown> = {}
      for (const m of ['is', 'not', 'neq', 'order']) q[m] = () => q
      let cols = ''
      q.select = (c: string) => { cols = c; selects.push(c); return q }
      q.limit = async () => (opts.selectError && cols.endsWith('harvested_at') ? { data: null, error: opts.selectError } : { data: opts.rows, error: null })
      q.update = (values: Row) => {
        const done = (id: unknown) => { updates.push({ values, id }); return Promise.resolve({ error: opts.updateError ?? null }) }
        return { eq: (_c: string, id: unknown) => done(id), in: (_c: string, ids: unknown) => done(ids) }
      }
      return q
    },
  } as unknown as ServiceClient
  return { service, updates, inserts, selects }
}

const row = (id: string, over: Row = {}): Row => ({ id, sender: 'TESTBANK', raw_body: BODY, bank_name: null, status: 'logged', parsed_ok: true, kind: 'purchase', parse_method: 'ai_new', currency: 'EGP', harvested_at: null, ...over })

describe('harvestBatch', () => {
  it('stamps learned_at, masker version, masked body and skeleton key per row', async () => {
    const { service, updates, inserts } = makeService({ rows: [row('a'), row('b')] })
    const r = await harvestBatch(service)
    expect(r).toMatchObject({ processed: 2, legacy: false })
    expect(updates).toHaveLength(2)
    for (const u of updates) {
      expect(u.values.learned_at).toBeTruthy()
      expect(u.values.masked_version).toBe(MASKER_VERSION)
      expect(typeof u.values.masked_body).toBe('string')
      expect(String(u.values.masked_body)).not.toContain('1234')
      expect(typeof u.values.skeleton_key).toBe('string')
    }
    expect(inserts[0]).toHaveLength(2)
  })

  it('rows already counted at ingest are stamped but not fed to the corpus again', async () => {
    const { service, updates, inserts } = makeService({ rows: [row('a', { harvested_at: '2026-09-01T00:00:00Z' })] })
    await harvestBatch(service)
    expect(inserts).toHaveLength(0)
    expect(updates[0].values.harvested_at).toBe('2026-09-01T00:00:00Z')
  })

  it('stamps before feeding the corpus: a failed stamp feeds nothing and handles nothing', async () => {
    const { service, inserts } = makeService({ rows: [row('a')], updateError: { code: 'XX' } })
    const r = await harvestBatch(service)
    expect(r.processed).toBe(0)
    expect(inserts).toHaveLength(0)
  })

  it('stamps a row with nothing to learn so it is not picked again', async () => {
    const { service, updates } = makeService({ rows: [row('a', { raw_body: 'ok' })] })
    await harvestBatch(service)
    expect(updates[0].values).toMatchObject({ masked_body: null, skeleton_key: null, masked_version: MASKER_VERSION })
  })

  it('bounds the batch size', async () => {
    const { service } = makeService({ rows: [] })
    const limit = vi.fn(async () => ({ data: [], error: null }))
    const spy = { from: () => ({ select: () => ({ is: () => ({ not: () => ({ neq: () => ({ order: () => ({ limit }) }) }) }) }) }) } as unknown as ServiceClient
    await harvestBatch(spy, 100000)
    expect(limit).toHaveBeenCalledWith(200)
    void service
  })

  it('falls back to the legacy harvested_at behaviour when the columns are missing', async () => {
    const { service, updates, inserts } = makeService({ rows: [row('a')], selectError: { code: '42703' } })
    const r = await harvestBatch(service)
    expect(r).toMatchObject({ processed: 1, legacy: true })
    expect(inserts).toHaveLength(1)
    expect(Object.keys(updates[0].values)).toEqual(['harvested_at'])
  })

  it('harvestLegacySms returns the processed count', async () => {
    const { service } = makeService({ rows: [row('a')] })
    expect(await harvestLegacySms(service)).toBe(1)
  })
})

describe('scanMaskedBodies', () => {
  it('reports counts only', () => {
    const r = scanMaskedBodies(['Purchase of ## EGP at <NAME>', 'Reach me at someone@example.com or 123456789012'])
    expect(r.rowsScanned).toBe(2)
    expect(r.rowsWithLeaks).toBe(1)
    expect(r.byKind.email).toBe(1)
    expect(JSON.stringify(r)).not.toContain('example.com')
  })
})
