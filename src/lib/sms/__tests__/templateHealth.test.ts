import { describe, it, expect } from 'vitest'
import {
  checkPlausibility,
  checkCurrencyAgainstAccount,
  checkCrossTemplateContradiction,
} from '../templateHealth'

const RECEIVED = '2026-07-24T10:00:00Z'

describe('R6 — plausibility', () => {
  it('passes a normal extraction', () => {
    expect(checkPlausibility({ amount: 386.4, last4: '2016', txDay: '2026-07-24' }, RECEIVED)).toEqual([])
  })

  it('flags a non-positive or absurd amount', () => {
    expect(checkPlausibility({ amount: 0, last4: null, txDay: null }, RECEIVED)[0].code).toBe('implausible_amount')
    expect(checkPlausibility({ amount: -5, last4: null, txDay: null }, RECEIVED)[0].code).toBe('implausible_amount')
    // Digits run together by a bad capture.
    expect(checkPlausibility({ amount: 99_999_999, last4: null, txDay: null }, RECEIVED)[0].code).toBe('implausible_amount')
  })

  it('flags a last4 that is not four digits', () => {
    expect(checkPlausibility({ amount: 10, last4: '20', txDay: null }, RECEIVED)[0].code).toBe('implausible_last4')
    expect(checkPlausibility({ amount: 10, last4: 'ABCD', txDay: null }, RECEIVED)[0].code).toBe('implausible_last4')
  })

  it('treats an absent last4 as no evidence, not a defect', () => {
    // A template that does not capture last4 must never be accused of getting it wrong.
    expect(checkPlausibility({ amount: 10, last4: null, txDay: null }, RECEIVED)).toEqual([])
  })

  it('flags a date nowhere near when the SMS arrived', () => {
    const out = checkPlausibility({ amount: 10, last4: null, txDay: '2024-01-01' }, RECEIVED)
    expect(out[0].code).toBe('implausible_date')
  })

  it('tolerates a normally-late delivery', () => {
    // Offline queue drains and delayed pushes are routine; a few days is not a defect.
    expect(checkPlausibility({ amount: 10, last4: null, txDay: '2026-07-18' }, RECEIVED)).toEqual([])
  })

  it('says nothing when there is no arrival time to compare against', () => {
    expect(checkPlausibility({ amount: 10, last4: null, txDay: '2020-01-01' }, null)).toEqual([])
  })
})

describe('R4 — currency vs the account it names', () => {
  const accounts = [
    { last4: '0001', currency: 'EGP' },
    { last4: '5124', currency: 'EGP' },
  ]

  it('flags a currency that contradicts a registered account', () => {
    const s = checkCurrencyAgainstAccount('USD', '0001', accounts)
    expect(s?.code).toBe('currency_account_mismatch')
  })

  it('passes when they agree, case-insensitively', () => {
    expect(checkCurrencyAgainstAccount('EGP', '0001', accounts)).toBeNull()
    expect(checkCurrencyAgainstAccount('egp', '0001', accounts)).toBeNull()
  })

  it('stays silent for an unregistered account', () => {
    // Most cards are never registered; absence of a record is not evidence of a defect.
    expect(checkCurrencyAgainstAccount('USD', '9999', accounts)).toBeNull()
  })

  it('stays silent when two accounts share a last4', () => {
    const ambiguous = [
      { last4: '0001', currency: 'EGP' },
      { last4: '0001', currency: 'USD' },
    ]
    expect(checkCurrencyAgainstAccount('USD', '0001', ambiguous)).toBeNull()
  })

  it('stays silent when the account currency is unknown', () => {
    expect(checkCurrencyAgainstAccount('USD', '0001', [{ last4: '0001', currency: null }])).toBeNull()
  })
})

describe('R3 — cross-template contradiction', () => {
  const f = (amount: number | null) => ({ amount, currency: 'EGP', kind: 'purchase', last4: null })

  it('reports BOTH templates when they disagree — we cannot tell which is wrong', () => {
    const out = checkCrossTemplateContradiction([
      { templateId: 'a', fields: f(386.4) },
      { templateId: 'b', fields: f(309.02) },
    ])
    expect(out.map((o) => o.templateId).sort()).toEqual(['a', 'b'])
    expect(out[0].signal.code).toBe('cross_template_contradiction')
  })

  it('says nothing when they agree', () => {
    expect(
      checkCrossTemplateContradiction([
        { templateId: 'a', fields: f(386.4) },
        { templateId: 'b', fields: f(386.4) },
      ]),
    ).toEqual([])
  })

  it('says nothing for a single template — there is no disagreement to have', () => {
    expect(checkCrossTemplateContradiction([{ templateId: 'a', fields: f(1) }])).toEqual([])
    expect(checkCrossTemplateContradiction([])).toEqual([])
  })

  it('compares at cent precision so float noise is not a contradiction', () => {
    expect(
      checkCrossTemplateContradiction([
        { templateId: 'a', fields: f(10.1) },
        { templateId: 'b', fields: f(10.100000001) },
      ]),
    ).toEqual([])
  })
})
