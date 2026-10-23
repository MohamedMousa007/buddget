import { describe, expect, it } from 'vitest'
import { extractBalance, resolveReportTarget } from './balanceReport'

describe('extractBalance', () => {
  it.each([
    ['From HSBC: 22JUL26 ELWAHAT FOR PETROLEM Purchase from 103-104***-001 EGP 715.00- Your available balance is EGP 3,571.53', 3571.53, 'EGP'],
    ['تم خصم EGP 12.75  من بطاقة الخصم المباشر # **6212 باستخدام Apple Pay عند  KAZYON في  07/07/26 17:16الرصيد المتاح  EGP3957.91.', 3957.91, 'EGP'],
    ['تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه.', 45.88, undefined],
    ['You have a Trx on your Card no. XXXX2939 from Talabat for EGP  204.16 on 19-May at 05:06 your available balance is 276.10', 276.1, undefined],
    ['Avl Bal is AED 15,234.50', 15234.5, 'AED'],
    ['تم استلام مبلغ 6000 جنيه. رصيدك الحالي: 6004.88 جنيه', 6004.88, undefined],
    ['الرصيد المتاح ٢٧٠٠٫٠٣', 2700.03, undefined],
  ])('%#', (body, balance, currency) => {
    const r = extractBalance(body)
    if (balance == null) return expect(r).toBeNull()
    expect(r?.balance).toBe(balance)
    expect(r?.currency).toBe(currency)
  })
  it('never reads a credit-card limit or an amount as a balance', () => {
    expect(extractBalance('Avl Cr. Limit is AED 30,978.13')).toBeNull()
    expect(extractBalance('Rejected transaction: Insufficient balance\nCard: **6774\nAmount: 5.74 USD')).toBeNull()
    expect(extractBalance('Purchase EGP 715.00 at SHOP')).toBeNull()
  })
})

describe('resolveReportTarget', () => {
  const m = (o: object) => ({ id: 'x', name: 'x', type: 'bank_account', last4: null, currency: 'EGP', parent_id: null, track_sms: true, closed_at: null, ...o })
  const methods = [m({ id: 'bank', last4: '2016' }), m({ id: 'debit', type: 'debit_card', last4: '4417', parent_id: 'bank' }), m({ id: 'cc', type: 'credit_card', last4: '8821', parent_id: 'bank' })]
  it('maps an account last4 to itself and a debit card to its parent; credit cards report limits, so never', () => {
    expect(resolveReportTarget(methods, '2016')?.id).toBe('bank')
    expect(resolveReportTarget(methods, '4417')?.id).toBe('bank')
    expect(resolveReportTarget(methods, '8821')).toBeNull()
    expect(resolveReportTarget(methods, '9999')).toBeNull()
    expect(resolveReportTarget(methods, null)).toBeNull()
  })
  it('falls back to the sending provider only when it names exactly one account', () => {
    const wallets = [m({ id: 'vf', type: 'wallet', name: 'Vodafone Cash' }), m({ id: 'cib', type: 'bank_account', name: 'CIB ••2016', last4: '2016' })]
    expect(resolveReportTarget(wallets, null, { bankName: 'Vodafone Cash' })?.id).toBe('vf')
    expect(resolveReportTarget([...wallets, m({ id: 'vf2', type: 'wallet', name: 'Vodafone Cash' })], null, { bankName: 'Vodafone Cash' })).toBeNull()
    expect(resolveReportTarget(wallets, null, { bankName: 'Unknown Bank' })).toBeNull()
  })
})
