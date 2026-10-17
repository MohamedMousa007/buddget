import { describe, expect, it } from 'vitest'
import { detectRecurringCharges, type ChargeRow } from './detectRecurringCharges'

const row = (day: string, amount: number, over: Partial<ChargeRow> = {}): ChargeRow => ({
  merchant: 'NETFLIX.COM', merchant_normalized: null, clean_title: null, amount, currency: 'EGP', day, ...over,
})
const none = new Set<string | null>()

describe('detectRecurringCharges', () => {
  it('suggests a brand charged twice at a consistent price', () => {
    const [d] = detectRecurringCharges([row('2026-08-10', 190), row('2026-09-10', 190)], none)
    expect(d).toMatchObject({ brandKey: 'netflix', amount: 190, currency: 'EGP', billingDay: 10, sightings: 2, months: 2 })
  })

  it('does not suggest a single sighting', () => {
    expect(detectRecurringCharges([row('2026-09-10', 190)], none)).toEqual([])
  })

  it('does not suggest two purchases at wildly different prices', () => {
    expect(detectRecurringCharges([row('2026-08-10', 190), row('2026-09-10', 900)], none)).toEqual([])
  })

  it('skips a brand the user already tracks (including a cancelled one)', () => {
    expect(detectRecurringCharges([row('2026-08-10', 190), row('2026-09-10', 190)], new Set(['netflix']))).toEqual([])
  })

  it('ignores unrelated merchants and zero-amount rows', () => {
    expect(detectRecurringCharges([row('2026-08-10', 50, { merchant: 'CARREFOUR' }), row('2026-09-10', 0)], none)).toEqual([])
  })

  it('takes the billing day from the consistent charges, not an outlier purchase', () => {
    const [d] = detectRecurringCharges(
      [row('2026-08-10', 190), row('2026-09-10', 190), row('2026-09-28', 900)],
      none
    )
    expect(d.billingDay).toBe(10)
    expect(d.sightings).toBe(2)
  })

  it('uses the most common currency rather than whichever row came first', () => {
    const [d] = detectRecurringCharges(
      [row('2026-07-01', 5, { currency: 'USD' }), row('2026-08-10', 190), row('2026-09-10', 190)],
      none
    )
    expect(d.currency).toBe('EGP')
  })

  it('does not blend two currencies into one plan', () => {
    expect(
      detectRecurringCharges([row('2026-08-10', 190), row('2026-09-10', 4, { currency: 'USD' })], none)
    ).toEqual([])
  })

  it('resolves Arabic merchant names', () => {
    const out = detectRecurringCharges(
      [row('2026-08-10', 190, { merchant: 'نتفليكس' }), row('2026-09-10', 190, { merchant: 'نتفليكس' })],
      none
    )
    expect(out[0]?.brandKey).toBe('netflix')
  })

  it('counts distinct months, so two charges in one month is one month', () => {
    const [d] = detectRecurringCharges([row('2026-09-01', 190), row('2026-09-10', 190)], none)
    expect(d.months).toBe(1)
  })
})
