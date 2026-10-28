import { describe, expect, it, vi } from 'vitest'
import { normalizeDigits } from '../normalizeDigits'
import { isNonTransaction } from '../patterns/preFilter'
import { CURRENCY_TOKEN_RE } from '../patterns/currency'
import { applyMappingRules } from '../templateApply'
import { extractIpnReference } from '../dispatch'
import { tryPairLeg } from '../pairing'

describe('normalizeDigits (S12)', () => {
  it('maps Arabic-Indic, Persian digits and separators', () => {
    expect(normalizeDigits('١٢٥٠٫٥٠ ****١٢٣٤ ۴۵۶ ١٬٢٥٠')).toBe('1250.50 ****1234 456 1,250')
  })
})

describe('preFilter (S1, S11)', () => {
  it('keeps a real purchase that carries an OTP footer', () => {
    expect(
      isNonTransaction('Your card ending 1234 was used for EGP 450.00 at CARREFOUR on 12/10/2026. Never share your PIN or OTP.'),
    ).toBeNull()
  })
  it('still rejects a pure OTP with an amount-free body', () => {
    expect(isNonTransaction('Your OTP is 123456. Do not share it.')).toBe('otp')
  })
  it('keeps a purchase at a merchant named BUNDLE', () => {
    expect(
      isNonTransaction('Your Credit Card ending with *1234 has been used for EGP 150.00 on 05/10/2026 at VODAFONE BUNDLE. Your available limit is EGP 4,850.00'),
    ).toBeNull()
    expect(isNonTransaction('تم استخدام بطاقتك بمبلغ 150 جنيه لدى فودافون باقة')).toBeNull()
  })
  it('does not match عرض inside معرض', () => {
    expect(isNonTransaction('معرض القاهرة للكتاب')).toBeNull()
    expect(isNonTransaction('عرض خاص لفترة محدودة')).toBe('marketing')
  })
  it('normalises Arabic digits before classifying', () => {
    expect(isNonTransaction('تم خصم مبلغ ١٢٥٠٫٥٠ جنيه من حسابك ****١٢٣٤')).toBeNull()
  })
})

describe('currency (S18)', () => {
  it('جم matches only as a whole word', () => {
    expect(CURRENCY_TOKEN_RE.test('مجمع التحرير')).toBe(false)
    expect(CURRENCY_TOKEN_RE.test('250 جم')).toBe(true)
  })
})

describe('templateApply (S5, S12)', () => {
  const rules = { amount: { group: 1 }, last4: { group: 2 }, kind: 'purchase' }
  it('strips thousands separators without removeCommas', () => {
    expect(applyMappingRules('paid 1,250.00 card 1234', 'paid ([\\d,.]+) card (\\d+)', rules)?.amount).toBe(1250)
    expect(applyMappingRules('paid 1٬250.00 card 1234', 'paid ([\\d٬,.]+) card (\\d+)', rules)?.amount).toBe(1250)
  })
  it('reads Arabic-Indic digits and last4', () => {
    const r = applyMappingRules('خصم ١٢٥٠٫٥٠ كارت ١٢٣٤', 'خصم ([\\d,.]+) كارت (\\d+)', rules)
    expect(r?.amount).toBe(1250.5)
    expect(r?.last4).toBe('1234')
  })
})

describe('extractIpnReference (S6, S7)', () => {
  it('does not capture the word "number"', () => {
    expect(extractIpnReference('Transfer with reference number sent to Ahmed')).toBeNull()
    expect(extractIpnReference('with reference number b3abc23b done')).toBe('b3abc23b')
  })
  it('requires a digit', () => {
    expect(extractIpnReference('reference confirmation')).toBeNull()
    expect(extractIpnReference('with reference b3abc23b')).toBe('b3abc23b')
  })
  it('reads the Arabic reference', () => {
    expect(extractIpnReference('تم تحويل لحظى بمبلغ 200 إلى  رقم مرجعى BEC93BC في 17/05/2026')).toBe('BEC93BC')
    expect(extractIpnReference('رقم مرجع ٢٤٢٩٢٠٩١٦١٢٣')).toBe('242920916123')
  })
})

describe('tryPairLeg retry (S8)', () => {
  it('retries once when the first call finds no sibling', async () => {
    const row = { sibling_id: 's', sibling_kind: 'own_transfer', sibling_status: 'logged' }
    const rpc = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [row], error: null })
    const res = await tryPairLeg({ rpc, from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) } as never, {
      userId: 'u', logId: 'l', receivedAtIso: '2026-01-01T00:00:00Z', amount: 5, kind: 'own_transfer',
    })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(res?.siblingId).toBe('s')
  })
})
