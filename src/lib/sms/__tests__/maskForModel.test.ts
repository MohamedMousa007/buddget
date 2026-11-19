import { describe, expect, it } from 'vitest'
import { maskForModel, maskForParse } from '../maskForModel'
import { maskTemplateSample, remaskTemplateRow } from '../templateSample'
import { redactSample } from '../exportTemplates'
import { sweepMaskedStores } from '../remaskStores'
import type { ServiceClient } from '@/lib/supabase/service'

describe('maskForModel (S2c step 9b)', () => {
  const msg = 'IPN transfer of EGP 5000.00 to Hassan Sample from account 1234567890 card 507803******6685 ref 98765432101 phone +20 100 123 4567 done'
  const view = maskForModel(msg, { merchant: 'Hassan Sample', kind: 'instant_transfer_out', amount: 5000 })

  it('replaces the name with a stand-in of the same word count, in the message and in the extraction', () => {
    expect(view.message).not.toContain('Hassan')
    expect(view.message).not.toContain('Sample')
    expect(view.merchant).not.toBeNull()
    expect(view.merchant).not.toMatch(/Hassan|Sample/)
    expect(view.merchant!.split(' ')).toHaveLength(2)
    expect(view.message).toContain(`to ${view.merchant}`)
  })

  it('replaces long digit runs with digits of the same length and keeps the last four of an account', () => {
    expect(view.message).not.toContain('98765432101')
    expect(view.message).toMatch(/ref \d{11}\b/)
    expect(view.message).not.toContain('1234567890')
    expect(view.message).toMatch(/account \d{6}7890/)
    expect(view.message).not.toContain('507803')
    expect(view.message).toContain('******6685')
    expect(view.message).not.toContain('100 123 4567')
  })

  it('keeps what the pattern has to capture: the amount, the currency, the structure', () => {
    expect(view.message).toContain('EGP 5000.00')
    expect(view.message).toContain('IPN transfer of')
    expect(view.message.length).toBeGreaterThan(msg.length - 10)
  })

  it('keeps an integer amount of five digits or more', () => {
    expect(maskForModel('Debit EGP 12500 at Shop', { merchant: null, kind: 'purchase', amount: 12500 }).message).toContain('EGP 12500')
  })

  it('masks an Arabic name with an Arabic stand-in and an e-mail address', () => {
    const v = maskForModel('تم تحويل 500 جنيه إلى ليلى منصور بتاريخ 12/11 contact a.b@example.org', { merchant: 'ليلى منصور', kind: 'instant_transfer_out', amount: 500 })
    expect(v.message).not.toContain('منصور')
    expect(v.message).not.toContain('a.b@')
    expect(v.merchant).toMatch(/^[؀-ۿ ]+$/)
  })

  it('masks the extracted merchant of a transfer even where the slot rule missed its spelling', () => {
    const v = maskForModel('Money sent. Receiver: hassan sample. EGP 5.00', { merchant: 'hassan sample', kind: 'instant_transfer_out', amount: 5 })
    expect(v.message).not.toMatch(/hassan/i)
    expect(v.merchant).not.toMatch(/hassan/i)
  })

  it('leaves a shop name alone for a purchase', () => {
    const v = maskForModel('Purchase EGP 20.00 at corner shop', { merchant: 'corner shop', kind: 'purchase', amount: 20 })
    expect(v.message).toBe('Purchase EGP 20.00 at corner shop')
    expect(v.merchant).toBe('corner shop')
  })
})

describe('template samples (S2c step 9a, 9c, 9e)', () => {
  const raw = 'Instant transfer to Hassan Sample EGP 120.50 ref 9876543210 from account ****1234'

  it('masks the sample, to a bounded length', () => {
    const m = maskTemplateSample(raw)
    expect(m).not.toContain('Hassan')
    expect(m).not.toContain('9876543210')
    expect(m).toContain('Instant transfer')
    expect(maskTemplateSample('x'.repeat(900)).length).toBe(500)
  })

  it('re-masks a stored row without touching its other fields, and a row with no sample', () => {
    const row = { id: 't1', template_sample: raw, match_count: 3 }
    expect(remaskTemplateRow(row)).toEqual({ id: 't1', template_sample: maskTemplateSample(raw), match_count: 3 })
    expect(remaskTemplateRow<{ id: string; template_sample?: string }>({ id: 't2' })).toEqual({ id: 't2' })
  })

  it('the export masks with the same masker', () => {
    expect(redactSample(raw)).not.toContain('Hassan')
    expect(redactSample(raw)).toContain('<NAME>')
  })

  it('the sweep re-masks stored template samples and leaves masked ones', async () => {
    const rows = [
      { id: 'a', template_sample: raw },
      { id: 'b', template_sample: maskTemplateSample(raw) },
    ]
    const updates: Array<{ table: string; values: Record<string, string>; id: string }> = []
    const service = {
      from: (table: string) => {
        let after = ''
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.not = () => q
        q.order = () => q
        q.gt = (_c: string, v: string) => { after = v; return q }
        q.limit = async (n: number) => ({ data: table === 'sms_tracking_templates_ai' ? rows.filter((r) => r.id > after).slice(0, n) : [], error: null })
        q.update = (values: Record<string, string>) => ({ eq: async (_c: string, id: string) => { updates.push({ table, values, id }); return { error: null } } })
        return q
      },
    } as unknown as ServiceClient
    const r = await sweepMaskedStores(service, () => false)
    expect(r).toMatchObject({ complete: true, remasked: 1, rowsWithLeaks: 0 })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ table: 'sms_tracking_templates_ai', id: 'a' })
    expect(updates[0]!.values.template_sample).not.toContain('Hassan')
  })
})

describe('keepNumbers (adjudicator view)', () => {
  const body = 'Purchase EGP 50000 on 20260720 card ending 4321 ref 12345678901234, EGP 1250.75, call +201012345678'
  const out = maskForModel(body, { merchant: null, kind: 'purchase', amount: 1 }, { keepNumbers: true }).message
  it('lets amounts, a compact date, a decimal amount and the last four through', () => {
    for (const keep of ['EGP 50000', '20260720', '1250.75', '4321']) expect(out).toContain(keep)
  })
  it('still replaces a phone-like number', () => {
    expect(out).not.toContain('201012345678')
  })
  it('replaces a person after to/from', () => {
    const m = maskForModel('Transfer from Hassan Sample EGP 50000 received', { merchant: 'Hassan Sample', kind: 'instant_transfer_in', amount: 50000 }, { keepNumbers: true }).message
    expect(m).not.toContain('Hassan')
    expect(m).toContain('50000')
  })
})

describe('maskForParse (QA-36): what the main AI parse sees', () => {
  // Real HSBC IPN wording (hsbc.ts) with a real-shaped phone and a 12-digit reference.
  const IPN = 'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 3.50 on 10-06-2026 02:16 to SALMA SAMY ELSAYED with reference 3f5b5478. Call 01012345678 ref 123456789012'
  const view = maskForParse(IPN)

  it('hides the counterparty name, the phone and the long reference; keeps amount, date, last four and balance words', () => {
    expect(view.message).not.toMatch(/SALMA|SAMY|ELSAYED/)
    expect(view.message).not.toContain('01012345678')
    expect(view.message).not.toContain('123456789012')
    expect(view.message).toContain('9012')
    expect(view.message).toContain('EGP 3.50')
    expect(view.message).toContain('10-06-2026 02:16')
    expect(view.message).toContain('********0001')
  })

  it('keeps a purchase merchant and a balance readable', () => {
    const p = 'Your HSBC Account ****0001 was debited EGP 250.00 for purchase at Carrefour Egypt on 09-06-2026. Your available balance is EGP 36,183.18'
    expect(maskForParse(p).message).toBe(p)
  })

  it('restores the real name in what the model returns', () => {
    const standIn = view.message.match(/to (.+?) with reference/)![1]!
    expect(view.restore(`Transfer to ${standIn}`)).toBe('Transfer to SALMA SAMY ELSAYED')
    expect(view.restore(null)).toBeNull()
  })
})
