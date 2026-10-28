import { describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { maskPii } from './maskPii'
import { maskSkeletonText } from './skeleton'
import { sweepMaskedStores } from './remaskStores'

type Row = Record<string, string>

function makeService(tables: Record<string, Row[]>, failUpdates = false) {
  const updates: Array<{ table: string; values: Row; id: string }> = []
  const service = {
    from: (table: string) => {
      let after = ''
      let keyCol = ''
      const q: Record<string, unknown> = {}
      q.select = (cols: string) => { keyCol = cols.split(',')[0]!.trim(); return q }
      q.not = () => q
      q.order = () => q
      q.gt = (_c: string, v: string) => { after = v; return q }
      q.limit = async (n: number) => ({ data: (tables[table] ?? []).filter((r) => r[keyCol]! > after).slice(0, n), error: null })
      q.update = (values: Row) => ({ eq: async (_c: string, id: string) => { updates.push({ table, values, id }); return { error: failUpdates ? { message: 'x' } : null } } })
      return q
    },
  } as unknown as ServiceClient
  return { service, updates }
}

const never = () => false

describe('mask idempotence', () => {
  it('re-masking a masked skeleton or correction changes nothing', () => {
    const sk = maskSkeletonText('Purchase of 1200.50 EGP at Uber Eats Cairo card 1234 Dear Valued Customer')
    expect(maskSkeletonText(sk)).toBe(sk)
    const c = maskPii('Purchase of 120.50 EGP from JOHN SMITH ref 98765432')
    expect(maskPii(c)).toBe(c)
  })
})

describe('sweepMaskedStores', () => {
  it('re-masks leaking corpus rows, leaves clean ones, and reports a clean full scan afterwards', async () => {
    const { service, updates } = makeService({
      sms_corpus: [
        { skeleton_key: 'a', redacted_body: 'Purchase of # EGP at Shop' },
        { skeleton_key: 'b', redacted_body: 'Transfer to Mohamed Ali Hassan for # EGP' },
      ],
      sms_corrections: [{ id: 'c1', redacted_body: 'Debit 120.50 EGP at Cafe by SARA AHMED 5551234567' }],
      sms_parse_log: [],
    })
    const r = await sweepMaskedStores(service, never)
    expect(r.complete).toBe(true)
    expect(r.rowsWithLeaks).toBe(0)
    expect(r.remasked).toBe(2)
    expect(updates.map((u) => u.id).sort()).toEqual(['b', 'c1'])
    expect(JSON.stringify(updates)).not.toContain('Mohamed')
    expect(JSON.stringify(r)).not.toContain('Mohamed')
  })

  it('counts a row as leaking when its re-mask could not be written', async () => {
    const { service } = makeService({ sms_corpus: [{ skeleton_key: 'b', redacted_body: 'Sent to Mohamed Ali Hassan' }], sms_corrections: [], sms_parse_log: [] }, true)
    const r = await sweepMaskedStores(service, never)
    expect(r.rowsWithLeaks).toBe(1)
  })

  it('is incomplete when the deadline passes', async () => {
    const { service } = makeService({ sms_corpus: [{ skeleton_key: 'a', redacted_body: 'x' }], sms_corrections: [], sms_parse_log: [] })
    const r = await sweepMaskedStores(service, () => true)
    expect(r.complete).toBe(false)
  })
})
