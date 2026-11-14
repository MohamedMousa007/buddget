import { describe, expect, it } from 'vitest'
import {
  isDeclineMessage,
  pickDeclineTwin,
  pickRefundOriginals,
  type DeclineTwinCandidate,
  type RefundCandidate,
  type RefundFacts,
} from './refundMatch'
import { referenceHash } from './ownTransferDecision'

const T0 = Date.parse('2026-10-27T10:00:00Z')
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const cand = (over: Partial<RefundCandidate> = {}): RefundCandidate => ({
  id: 'c1', kind: 'purchase', amount: 300, currency: 'EGP', account_last4: '4444', received_at: iso(-DAY),
  reference_hash: null, merchant_normalized: null, clean_title: null, expense_id: 'e1', ...over,
})
const refund = (over: Partial<RefundFacts> = {}): RefundFacts => ({
  logId: 'r1', amount: 300, currency: 'EGP', last4: '4444', receivedAtMs: T0, referenceHash: null, merchant: null, ...over,
})
const rules = (cs: RefundCandidate[], r: RefundFacts) => pickRefundOriginals(cs, r).map((p) => `${p.candidate.id}:${p.rule}`)

describe('isDeclineMessage (I2)', () => {
  it('kind declined is a decline whatever the words', () => {
    expect(isDeclineMessage('declined', 'anything')).toBe(true)
  })
  it('a refund worded declined, rejected or refused is a decline', () => {
    expect(isDeclineMessage('refund', 'The transaction was rejected by the bank')).toBe(true)
    expect(isDeclineMessage('refund', 'Request refused')).toBe(true)
    expect(isDeclineMessage('refund', 'العملية مرفوضة')).toBe(true)
  })
  it('reversed wording is a refund, not a decline', () => {
    expect(isDeclineMessage('refund', 'The transaction was reversed to your card')).toBe(false)
    expect(isDeclineMessage('refund', 'تم عكس العملية')).toBe(false)
  })
})

describe('pickRefundOriginals', () => {
  it('I1 (a): the same reference hash matches whatever the amount, account and age (inside 90 days)', () => {
    const h = referenceHash('u1', 'AB12CD34')
    const c = cand({ kind: 'instant_transfer_out', amount: 1000, account_last4: null, received_at: iso(-40 * HOUR), reference_hash: h })
    expect(rules([c], refund({ amount: 999, last4: null, referenceHash: h }))).toEqual(['c1:reference'])
  })
  it('I1 (a): a different or missing reference does not match on reference', () => {
    const c = cand({ kind: 'instant_transfer_out', received_at: iso(-40 * HOUR), reference_hash: referenceHash('u1', 'aaaa1111') })
    expect(rules([c], refund({ referenceHash: referenceHash('u1', 'bbbb2222') }))).toEqual([])
    expect(rules([c], refund({ referenceHash: null }))).toEqual([])
  })
  it('I1 (a): a candidate older than 90 days is out even on the same reference', () => {
    const h = referenceHash('u1', 'ab12cd34')
    expect(rules([cand({ reference_hash: h, received_at: iso(-91 * DAY) })], refund({ referenceHash: h }))).toEqual([])
  })
  it('I1 (a): most recent first', () => {
    const h = referenceHash('u1', 'ab12cd34')
    const older = cand({ id: 'old', reference_hash: h, received_at: iso(-5 * DAY) })
    const newer = cand({ id: 'new', reference_hash: h, received_at: iso(-1 * DAY) })
    expect(rules([older, newer], refund({ referenceHash: h }))).toEqual(['new:reference', 'old:reference'])
  })
  it('I1 (b): same tail and amount 16 seconds later, no merchant, matches', () => {
    const c = cand({ kind: 'instant_transfer_out', received_at: iso(-16_000) })
    expect(rules([c], refund())).toEqual(['c1:window'])
  })
  it('I1 (b): a shorter printed tail names a longer saved one', () => {
    const c = cand({ account_last4: '0001', received_at: iso(-10 * MIN) })
    expect(rules([c], refund({ last4: '001' }))).toEqual(['c1:window'])
  })
  it('I1 (b): nearest in time first, and 16 minutes is outside the window', () => {
    const near = cand({ id: 'near', received_at: iso(-2 * MIN) })
    const far = cand({ id: 'far', received_at: iso(-12 * MIN) })
    const out = cand({ id: 'out', received_at: iso(-16 * MIN) })
    expect(rules([far, out, near], refund())).toEqual(['near:window', 'far:window'])
  })
  it('I1 (b): a candidate up to 15 minutes after the refund still counts, later does not', () => {
    expect(rules([cand({ received_at: iso(10 * MIN) })], refund())).toEqual(['c1:window'])
    expect(rules([cand({ received_at: iso(16 * MIN) })], refund())).toEqual([])
  })
  it('I1 (b): different amount, currency or tail does not match', () => {
    const at = iso(-MIN)
    expect(rules([cand({ amount: 301, received_at: at })], refund())).toEqual([])
    expect(rules([cand({ currency: 'USD', received_at: at })], refund())).toEqual([])
    expect(rules([cand({ account_last4: '9999', received_at: at })], refund())).toEqual([])
  })
  it('I1 (c): same merchant, tail and exact amount 20 days earlier matches', () => {
    const c = cand({ received_at: iso(-20 * DAY), merchant_normalized: 'Spinneys' })
    expect(rules([c], refund({ merchant: 'SPINNEYS ' }))).toEqual(['c1:merchant'])
  })
  it('I1 (c): the stored clean title stands in when the normalised merchant is missing', () => {
    const c = cand({ received_at: iso(-20 * DAY), clean_title: 'Spinneys' })
    expect(rules([c], refund({ merchant: 'spinneys' }))).toEqual(['c1:merchant'])
  })
  it('I1 (c): a different merchant does not match', () => {
    const c = cand({ received_at: iso(-20 * DAY), merchant_normalized: 'Spinneys' })
    expect(rules([c], refund({ merchant: 'Carrefour' }))).toEqual([])
  })
  it('I1 (c): an empty merchant on either side never matches', () => {
    const c = cand({ received_at: iso(-20 * DAY), merchant_normalized: 'Spinneys' })
    expect(rules([c], refund({ merchant: null }))).toEqual([])
    expect(rules([c], refund({ merchant: '  ' }))).toEqual([])
    expect(rules([cand({ received_at: iso(-20 * DAY) })], refund({ merchant: 'Spinneys' }))).toEqual([])
  })
  it('I7: a refund with no account tail hits neither (b) nor (c)', () => {
    const near = cand({ id: 'near', received_at: iso(-MIN), merchant_normalized: 'Spinneys' })
    const old = cand({ id: 'old', received_at: iso(-20 * DAY), merchant_normalized: 'Spinneys' })
    expect(rules([near, old], refund({ last4: null, merchant: 'Spinneys' }))).toEqual([])
  })
  it('I7: a candidate with no account tail hits neither (b) nor (c)', () => {
    const near = cand({ id: 'near', account_last4: null, received_at: iso(-MIN), merchant_normalized: 'Spinneys' })
    expect(rules([near], refund({ merchant: 'Spinneys' }))).toEqual([])
  })
  it('I1: only purchases, online purchases and transfers out are candidates', () => {
    const at = iso(-MIN)
    for (const kind of ['atm_withdrawal', 'fee', 'cc_payoff', 'installment_payment', 'own_transfer', 'instant_transfer_in', 'income', null]) {
      expect(rules([cand({ kind, received_at: at })], refund())).toEqual([])
    }
    for (const kind of ['purchase', 'online_purchase', 'instant_transfer_out']) {
      expect(rules([cand({ kind, received_at: at })], refund())).toEqual(['c1:window'])
    }
  })
  it('I1: a message that booked no row, and the refund itself, are never candidates', () => {
    expect(rules([cand({ expense_id: null, received_at: iso(-MIN) })], refund())).toEqual([])
    expect(rules([cand({ id: 'r1', received_at: iso(-MIN) })], refund())).toEqual([])
  })
  it('one candidate is listed once, under the first rule that hit', () => {
    const h = referenceHash('u1', 'ab12cd34')
    expect(rules([cand({ reference_hash: h, received_at: iso(-MIN) })], refund({ referenceHash: h }))).toEqual(['c1:reference'])
  })
  it('rules come in order: reference, then window, then merchant', () => {
    const h = referenceHash('u1', 'ab12cd34')
    const byMerchant = cand({ id: 'm', received_at: iso(-20 * DAY), merchant_normalized: 'Spinneys' })
    const byWindow = cand({ id: 'w', received_at: iso(-MIN) })
    const byRef = cand({ id: 'r', account_last4: null, amount: 5, received_at: iso(-3 * DAY), reference_hash: h })
    expect(rules([byMerchant, byWindow, byRef], refund({ referenceHash: h, merchant: 'Spinneys' }))).toEqual(['r:reference', 'w:window', 'm:merchant'])
  })
})

const own = (over: Partial<DeclineTwinCandidate> = {}): DeclineTwinCandidate => ({
  id: 'x1', category: 'Other', sms_log_id: 'l1', refund_sms_log_id: 'l1', refund_kind: 'declined', refunded_at: '2026-10-27', payment_method_id: 'pm1', ...over,
})

describe('pickDeclineTwin (I2)', () => {
  const decline = { day: '2026-10-28', paymentMethodId: 'pm1' }
  it('acknowledges against an earlier decline row that a decline created for itself', () => {
    expect(pickDeclineTwin([own()], decline)?.id).toBe('x1')
  })
  it('never against a purchase a refund stamped (its stamp names a different message)', () => {
    expect(pickDeclineTwin([own({ sms_log_id: 'purchase-log', refund_sms_log_id: 'refund-log', refund_kind: 'refunded' })], decline)).toBeNull()
    expect(pickDeclineTwin([own({ sms_log_id: 'purchase-log', refund_sms_log_id: 'refund-log' })], decline)).toBeNull()
  })
  it('never against a hand-entered row (no message of its own)', () => {
    expect(pickDeclineTwin([own({ sms_log_id: null, refund_sms_log_id: null })], decline)).toBeNull()
    expect(pickDeclineTwin([own({ sms_log_id: null, refund_sms_log_id: 'l1' })], decline)).toBeNull()
  })
  it('the window is exactly 3 days either side', () => {
    expect(pickDeclineTwin([own({ refunded_at: '2026-10-25' })], decline)?.id).toBe('x1')
    expect(pickDeclineTwin([own({ refunded_at: '2026-10-24' })], decline)).toBeNull()
    expect(pickDeclineTwin([own({ refunded_at: '2026-10-31' })], decline)?.id).toBe('x1')
    expect(pickDeclineTwin([own({ refunded_at: '2026-11-01' })], decline)).toBeNull()
  })
  it('a named payment method must be the same one; an unknown one constrains nothing', () => {
    expect(pickDeclineTwin([own({ payment_method_id: 'pm2' })], decline)).toBeNull()
    expect(pickDeclineTwin([own({ payment_method_id: null })], decline)).toBeNull()
    expect(pickDeclineTwin([own({ payment_method_id: 'pm2' })], { ...decline, paymentMethodId: null })?.id).toBe('x1')
  })
  it('the most recent own row wins', () => {
    expect(pickDeclineTwin([own({ id: 'a', refunded_at: '2026-10-26' }), own({ id: 'b', refunded_at: '2026-10-28' })], decline)?.id).toBe('b')
  })
})

describe('referenceHash', () => {
  it('I1: the same reference gives different hashes for different users', () => {
    expect(referenceHash('u1', 'ab12cd34')).not.toBe(referenceHash('u2', 'ab12cd34'))
  })
  it('I1: case-insensitive, 32 hex characters, null in null out', () => {
    expect(referenceHash('u1', 'AB12CD34')).toBe(referenceHash('u1', 'ab12cd34'))
    expect(referenceHash('u1', 'ab12cd34')).toMatch(/^[0-9a-f]{32}$/)
    expect(referenceHash('u1', null)).toBeNull()
    expect(referenceHash('u1', '')).toBeNull()
  })
})
