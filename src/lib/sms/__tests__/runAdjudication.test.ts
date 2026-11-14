import { describe, expect, it, vi } from 'vitest'
import { runAdjudication } from '../runAdjudication'
import { validateCorrection } from '../adjudicator'

const BODY = 'Purchase of EGP 1,250.75 at SHOP with card ending 4321 on 2026-07-20. Balance EGP 9,000.00'

describe('N11a: a verdict applies only to the signals of the judged message', () => {
  it('marks the signals of the judged log and leaves the others pending', async () => {
    const signals = [
      { id: 's1', template_id: 't1', sms_log_id: 'logA', user_id: 'u1', signal_kind: 'delete', field: null, old_value: null, new_value: null },
      { id: 's2', template_id: 't1', sms_log_id: 'logB', user_id: 'u2', signal_kind: 'delete', field: null, old_value: null, new_value: null },
      { id: 's3', template_id: 't1', sms_log_id: 'logA', user_id: 'u3', signal_kind: 'reported', field: null, old_value: null, new_value: null },
    ]
    const marked: string[][] = []
    const selectedLogs: string[] = []
    const service = {
      rpc: vi.fn(async (fn: string) => ({ data: fn === 'sms_templates_awaiting_adjudication' ? [{ template_id: 't1' }] : null })),
      from: (table: string) => {
        const c: Record<string, unknown> = {}
        let forTemplate = false
        for (const m of ['select', 'eq', 'is', 'lt', 'order', 'limit']) c[m] = (...a: unknown[]) => {
          if (m === 'eq' && a[0] === 'id') selectedLogs.push(a[1] as string)
          if (m === 'eq' && a[0] === 'template_id') forTemplate = true
          return c
        }
        c.maybeSingle = async () => ({ data: { raw_body: BODY, amount: 1250.75, currency: 'EGP', kind: 'purchase', account_last4: '4321', received_at: '2026-07-20T10:00:00Z' } })
        c.update = () => ({ in: async (_c: string, ids: string[]) => { marked.push(ids) } })
        c.insert = async () => ({})
        c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: table === 'sms_template_signals' && forTemplate ? signals : [] }).then(res)
        return c
      },
    }
    const askModel = vi.fn(async () => ({ verdict: 'user_preference', confidence: 0.9 }))
    const r = await runAdjudication(service as never, { askModel })
    expect(selectedLogs).toEqual(['logA'])
    expect(marked[0]).toEqual(['s1', 's3'])
    expect(r.adjudicated).toBe(2)
  })
})

describe('N10: corrections are validated against the real body', () => {
  it('keeps fields the body supports', () => {
    expect(validateCorrection({ amount: 1250.75, currency: 'egp', kind: 'purchase', last4: '4321', date: '2026-07-20' }, BODY))
      .toEqual({ amount: 1250.75, currency: 'EGP', kind: 'purchase', last4: '4321', date: '2026-07-20' })
  })
  it('compares amounts numerically and reads Arabic-Indic digits', () => {
    expect(validateCorrection({ amount: 9000 }, BODY)).toEqual({ amount: 9000 })
    expect(validateCorrection({ amount: 150 }, 'خصم ١٥٠٫٠٠ جم')).toEqual({ amount: 150 })
  })
  it('drops an invented amount, currency, kind, last4 and date', () => {
    expect(validateCorrection({ amount: 999, currency: 'XYZ', kind: 'bribe', last4: '9999', date: '2026-02-31' }, BODY)).toBeUndefined()
    expect(validateCorrection({ amount: 125, last4: '432', date: '1999-01-01' }, BODY)).toEqual({ last4: '432' })
  })
  it('returns nothing for a null correction', () => {
    expect(validateCorrection(undefined, BODY)).toBeUndefined()
  })
})
