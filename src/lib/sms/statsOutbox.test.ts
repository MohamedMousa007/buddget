import { describe, expect, it } from 'vitest'
import { buildStatsRow } from './statsOutbox'
import { smsSkeleton } from './skeleton'

describe('smsSkeleton', () => {
  it('gives two messages from one template the same key, whatever the numbers', () => {
    const a = smsSkeleton('Purchase of EGP 150.00 at Carrefour with card ending 1234 on 12/10/2026', 'CIB')
    const b = smsSkeleton('Purchase of EGP 75.50 at Carrefour with card ending 9876 on 19/10/2026', 'CIB')
    expect(a).not.toBeNull()
    expect(a!.key).toBe(b!.key)
  })
  it('keeps no digits and no all-caps names, and separates senders', () => {
    const sk = smsSkeleton('Transfer received from MOHAMED ALI HASSAN account 123456789012 amount 500', 'NBE')!
    expect(sk.redacted).not.toMatch(/\d/)
    expect(sk.redacted).toContain('<NAME>')
    expect(smsSkeleton('Transfer received from MOHAMED ALI HASSAN account 123456789012 amount 500', 'CIB')!.key).not.toBe(sk.key)
  })
  it('ignores messages too short to carry a shape', () => {
    expect(smsSkeleton('Hi', null)).toBeNull()
  })
})

describe('buildStatsRow', () => {
  const base = { userId: 'u1', senderKey: 'CIB', message: 'Purchase of EGP 150 at Carrefour card ending 1234', templateId: 't1', currency: null, isTransaction: true, parsedOk: true, kind: 'purchase', parseMethod: 'template', currencyCode: 'EGP' }
  it('carries pools, template and corpus fields for a transaction', () => {
    const r = buildStatsRow({ ...base, currency: { value: 'EGP', confirmed: true } })
    expect(r.sender).toBe('CIB')
    expect(r.kw).toContain('purchase')
    expect(r.kw).toHaveLength(r.kw_lang!.length)
    expect(r).toMatchObject({ template_id: 't1', bump_match: true, ccy_sender: 'CIB', ccy_currency: 'EGP', ccy_confirmed: true, parsed_ok: true })
    expect(r.skeleton_key).toMatch(/^[0-9a-f]{32}$/)
  })
  it('keeps non-transactions out of the keyword pool and counts evidence without a match', () => {
    const r = buildStatsRow({ ...base, isTransaction: false, parsedOk: false, countMatch: false })
    expect(r.kw).toEqual([])
    expect(r.sender).toBeNull()
    expect(r.sender_key).toBe('CIB')
    expect(r.bump_match).toBe(false)
  })
})
