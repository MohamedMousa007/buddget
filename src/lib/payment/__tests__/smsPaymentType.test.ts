import { describe, it, expect } from 'vitest'
import { paymentTypeFromSms } from '../smsPaymentType'

// Real bodies from sms_parse_log (July 2026), digits masked. Every one of these
// parsed via the AI tier, so payment_instrument is null — the body is the only
// type signal they have.
describe('paymentTypeFromSms', () => {
  it('reads the type from bodies no curated pattern covers (instrument null)', () => {
    expect(
      paymentTypeFromSms('Your Debit Card **6831 had a Successful transaction of EGP 1884.50 @EL SALAM SHOPPING CE', null),
    ).toBe('debit_card')
    expect(
      paymentTypeFromSms('POS Purchase\nMada card: **8774\namount:2.00 SAR\nBalance: 23.11\natESTABLISHMENT', null),
    ).toBe('debit_card')
    expect(
      paymentTypeFromSms('تم خصم مبلغ  EGP 815.00 من بطاقة الخصم المباشر المنتهية بـ **1887 عند CHILLOUT', null),
    ).toBe('debit_card')
    expect(paymentTypeFromSms('Adding money to account\nAmount: 400 SAR', null)).toBe('bank_account')
  })

  it('splits credit from debit — the curated instrument only says "card"', () => {
    expect(paymentTypeFromSms('Your Credit Card **1234 was charged EGP 500', 'card')).toBe('credit_card')
    expect(paymentTypeFromSms('Your Debit Card **1234 was charged EGP 500', 'card')).toBe('debit_card')
  })

  it('prefers the card over the account when a body names both', () => {
    // The detected last4 is the card's, so the account mention must not win.
    expect(
      paymentTypeFromSms('Online Purchase\nMada card: **8774\nAmount: 86.25 SAR\nat:Mobily\nA/C: **9207', null),
    ).toBe('debit_card')
  })

  it('reads only card-adjacent phrasing, not bare brand names', () => {
    // A merchant called "MADA STORE" must not turn an account SMS into a card.
    expect(paymentTypeFromSms('Adding money to account\nAmount: 400 SAR\nAt: MADA STORE', null)).toBe('bank_account')
    // Brand -> type is the catalogue's job, and it types Meeza as prepaid.
    expect(paymentTypeFromSms('Meeza purchase of EGP 50 at Talabat', null)).toBeNull()
  })

  it('falls back to the curated instrument when the body says nothing', () => {
    expect(paymentTypeFromSms('EGP 200 spent at Talabat', 'wallet')).toBe('wallet')
    expect(paymentTypeFromSms('EGP 200 spent at Talabat', null)).toBeNull()
    expect(paymentTypeFromSms(null, 'account')).toBe('bank_account')
  })
})
