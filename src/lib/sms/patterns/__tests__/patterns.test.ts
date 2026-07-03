import { describe, it, expect } from 'vitest'
import { matchCuratedPattern, ALL_PATTERN_SETS } from '../index'
import { isNonTransaction } from '../preFilter'

// Real captured SMS (sms_parse_log, June 2026) — first-class fixtures.
const HSBC_IPN_OUT =
  'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 3.50 on 10-06-2026 02:16 to SALMA SAMY ELSAYED with reference 3f5b5478. For further details, please contact HSBC call centre'
const HSBC_IPN_IN =
  'Your HSBC Account ********0001 was credited with IPN inward transfer for EGP 2.00 on 08-06-2026 01:01 from KARIM HAZEM MOHAMED ABO ELENEN with reference 6d158f5b. For further details, please contact HSBC call centre'
const HSBC_PURCHASE =
  'Your HSBC Account ****0001 was debited EGP 250.00 for purchase at Carrefour Egypt on 09-06-2026'

describe('curated pattern matcher', () => {
  it('parses HSBC IPN outward transfer', () => {
    const m = matchCuratedPattern(HSBC_IPN_OUT, 'HSBC')
    expect(m).not.toBeNull()
    expect(m!.patternId).toBe('hsbc-ipn-out')
    expect(m!.kind).toBe('instant_transfer_out')
    expect(m!.amount).toBe(3.5)
    expect(m!.currency).toBe('EGP')
    expect(m!.counterparty).toBe('SALMA SAMY ELSAYED')
    expect(m!.last4).toBe('0001')
    expect(m!.txDay).toBe('2026-06-10')
    expect(m!.paymentInstrument).toBe('account')
    expect(m!.cleanTitle).toBe('Transfer to SALMA SAMY ELSAYED')
  })

  it('parses HSBC IPN inward transfer as income kind', () => {
    const m = matchCuratedPattern(HSBC_IPN_IN, 'HSBC')
    expect(m).not.toBeNull()
    expect(m!.patternId).toBe('hsbc-ipn-in')
    expect(m!.kind).toBe('instant_transfer_in')
    expect(m!.amount).toBe(2)
    expect(m!.counterparty).toBe('KARIM HAZEM MOHAMED ABO ELENEN')
    expect(m!.txDay).toBe('2026-06-08')
  })

  it('parses HSBC account purchase with merchant + comma amounts', () => {
    const m = matchCuratedPattern(HSBC_PURCHASE, 'HSBC')
    expect(m).not.toBeNull()
    expect(m!.patternId).toBe('hsbc-account-purchase')
    expect(m!.kind).toBe('purchase')
    expect(m!.amount).toBe(250)
    expect(m!.counterparty).toBe('Carrefour Egypt')
    expect(m!.cleanTitle).toBe('Carrefour Egypt')

    const big = HSBC_PURCHASE.replace('250.00', '1,250.50')
    expect(matchCuratedPattern(big, 'HSBC')!.amount).toBe(1250.5)
  })

  it('matches regardless of sender casing and even with unknown sender', () => {
    expect(matchCuratedPattern(HSBC_IPN_OUT, 'hsbc')).not.toBeNull()
    expect(matchCuratedPattern(HSBC_IPN_OUT, null)).not.toBeNull()
  })

  it('returns null for non-matching text', () => {
    expect(matchCuratedPattern('Hello, your appointment is tomorrow', 'HSBC')).toBeNull()
  })

  it('never matches unverified patterns', () => {
    for (const set of ALL_PATTERN_SETS) {
      for (const p of set.patterns.filter((x) => !x.verified)) {
        // Unverified patterns are skipped even when their regex would match.
        const synthetic = 'card ending 1234 was charged EGP 100.00 at Test Store on 01-01-2026'
        if (p.regex.test(synthetic)) {
          expect(matchCuratedPattern(synthetic, set.bank)?.patternId).not.toBe(p.id)
        }
      }
    }
  })
})

// Real captures from open-source Egyptian finance apps (see docs/SMS_PATTERN_RESEARCH.md).
const CIB_CC_PURCHASE =
  'Your credit card ending with#8016 was charged for EGP 118.00 at SAOOD MARKET on 24/11/25  at 18:27. Card available limit is EGP  10000.21. For more details, please visit https://cib.eg/mb'
const CIB_CC_PURCHASE_V2 =
  'Your credit card #8810 was charged for USD 22.80 at ANTHROPIC CLAU on 01/06/26 at 15:26. Available limit is 132729.84 and the available international limit to use is EGP 137922'
const CIB_DEBIT_APPLEPAY =
  'تم خصم EGP 10.00  من بطاقة الخصم المباشر # **2326 باستخدام Apple Pay عند  CITYSTARS FOR MANAGEME في  23/05/26 16:24 الرصيد المتاح  EGP2700.03.'
const CIB_ATM =
  'تم سحب مبلغ  EGP 100.00  من بطاقة الخصم المباشر المنتهية بـ **2326 من        BDC HORYA في 19/05/26 19:55 ، الرصيد المتاح EGP 200.11'
const CIB_IPN_OUT =
  'يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 1000.00 جم من حسابك المنتهي بـ ****1065 برقم مرجعي 819a53fa بتاريخ 26-05-2026 19:35 للمزيد، برجاء الاتصال بـ 19666'
const CIB_IPN_IN =
  'يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 10.00 جم إلى حسابك المنتهي بـ ********1065 من KARIM MOHAMED MORSI ISM برقم مرجعي 1ac56f40 بتاريخ 31-05-2026 05:21 للمزيد، برجاء الاتصال بـ 19666'
const VFCASH_RECEIVE =
  'تم استلام مبلغ 6000 جنيه من رقم 01094490330 المسجل بإسم Mohamed S Amer على رقم محفظتك 01024193022.\nرصيدك الحالي: 6004.88 جنيه\nتابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash'
const VFCASH_CASHOUT =
  'تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه. تاريخ العملية 11:44 26-05-04 رقم العملية; 019697621640.'
const GENERIC_CARD_TRX =
  'You have a Trx on your Card no. XXXX2939 from Talabat for EGP  204.16 on 19-May at 05:06  GMT+3 your available balance is 276.10 for more info please call 19123'
const GENERIC_DEPOSIT =
  'تم إيداع EGP 7900 إلى حساب رقم #0014 يوم 06/04/2026 13:24 المتاح 220157.61 EGP للمزيد اتصل ب 19123'
const HSBC_CC =
  'Your Credit Card ending with * 1234 has been used for EGP 1339.50 on 27/05/2026 at WE-FBB-Pre. Your available limit is EGP 100.00'
// Real admin-log failure case — was mis-rejected as balance_only due to trailing balance clause
const HSBC_PHONE_BANKING_TRANSFER =
  '13JUN26 Phone Banking Transfer to 103-104***-001 EGP 30,000.48+ Your available balance is EGP 36,183.18'
// NBE Instapay card credit — the iOS bridge strips the sender, so this must
// match on body alone (real capture, sms_parse_log 2026-06-12).
const NBE_IPN_IN_CARD =
  'تم إضافة تحويل لحظي الي بطاقة رقم 507803******6685 بمبلغ 2 من MOHAMED MOUSSA ABDELLATIF رقم مرجعي 222267828819يوم 2026-06-12 الساعه 22:32 للمزيد اتصل علي 19888 '

describe('CIB curated patterns', () => {
  it('parses EN credit card purchase (both template generations)', () => {
    const m1 = matchCuratedPattern(CIB_CC_PURCHASE, 'CIB')
    expect(m1?.patternId).toBe('cib-cc-purchase-en')
    expect(m1?.amount).toBe(118)
    expect(m1?.currency).toBe('EGP')
    expect(m1?.counterparty).toBe('SAOOD MARKET')
    expect(m1?.last4).toBe('8016')
    expect(m1?.txDay).toBe('2025-11-24')
    expect(m1?.paymentInstrument).toBe('card')

    const m2 = matchCuratedPattern(CIB_CC_PURCHASE_V2, 'CIB')
    expect(m2?.patternId).toBe('cib-cc-purchase-en')
    expect(m2?.amount).toBe(22.8)
    expect(m2?.currency).toBe('USD')
    expect(m2?.counterparty).toBe('ANTHROPIC CLAU')
  })

  it('parses AR Apple Pay debit + ATM withdrawal', () => {
    const pos = matchCuratedPattern(CIB_DEBIT_APPLEPAY, 'CIB')
    expect(pos?.patternId).toBe('cib-debit-pos-ar')
    expect(pos?.amount).toBe(10)
    expect(pos?.last4).toBe('2326')
    expect(pos?.counterparty).toContain('CITYSTARS')

    const atm = matchCuratedPattern(CIB_ATM, 'CIB')
    expect(atm?.patternId).toBe('cib-atm-ar')
    expect(atm?.kind).toBe('atm_withdrawal')
    expect(atm?.amount).toBe(100)
    expect(atm?.txDay).toBe('2026-05-19')
  })

  it('parses AR IPN transfers with direction from من/إلى حسابك', () => {
    const out = matchCuratedPattern(CIB_IPN_OUT, 'CIB')
    expect(out?.patternId).toBe('cib-ipn-out-ar')
    expect(out?.kind).toBe('instant_transfer_out')
    expect(out?.amount).toBe(1000)
    expect(out?.currency).toBe('EGP')
    expect(out?.txDay).toBe('2026-05-26')

    const inc = matchCuratedPattern(CIB_IPN_IN, 'CIB')
    expect(inc?.patternId).toBe('cib-ipn-in-ar')
    expect(inc?.kind).toBe('instant_transfer_in')
    expect(inc?.counterparty).toBe('KARIM MOHAMED MORSI ISM')
  })
})

describe('Vodafone Cash + generic bank patterns', () => {
  it('parses wallet receive and cash-out', () => {
    const rec = matchCuratedPattern(VFCASH_RECEIVE, 'VF-Cash')
    expect(rec?.patternId).toBe('vfcash-receive-ar')
    expect(rec?.kind).toBe('instant_transfer_in')
    expect(rec?.amount).toBe(6000)
    expect(rec?.counterparty).toBe('Mohamed S Amer')
    expect(rec?.paymentInstrument).toBe('wallet')

    const out = matchCuratedPattern(VFCASH_CASHOUT, 'VF-Cash')
    expect(out?.patternId).toBe('vfcash-cashout-ar')
    expect(out?.amount).toBe(5900)
  })

  it('parses generic card trx + deposit via fallback pass (unknown sender)', () => {
    const trx = matchCuratedPattern(GENERIC_CARD_TRX, '19123')
    expect(trx?.patternId).toBe('generic-card-trx-en')
    expect(trx?.amount).toBe(204.16)
    expect(trx?.counterparty).toBe('Talabat')
    expect(trx?.last4).toBe('2939')

    const dep = matchCuratedPattern(GENERIC_DEPOSIT, null)
    expect(dep?.patternId).toBe('generic-deposit-ar')
    expect(dep?.kind).toBe('income')
    expect(dep?.amount).toBe(7900)
    expect(dep?.txDay).toBe('2026-04-06')
  })

  it('parses HSBC credit card purchase', () => {
    const m = matchCuratedPattern(HSBC_CC, 'HSBC')
    expect(m?.patternId).toBe('hsbc-cc-purchase')
    expect(m?.amount).toBe(1339.5)
    expect(m?.counterparty).toBe('WE-FBB-Pre')
    expect(m?.txDay).toBe('2026-05-27')
  })

  it('parses HSBC Phone Banking Transfer credit leg (+) as currency_exchange', () => {
    const m = matchCuratedPattern(HSBC_PHONE_BANKING_TRANSFER, 'HSBC')
    expect(m?.patternId).toBe('hsbc-phone-banking-fx-credit')
    expect(m?.kind).toBe('currency_exchange')
    expect(m?.amount).toBe(30000.48)
    expect(m?.currency).toBe('EGP')
    expect(m?.counterparty).toBe('103-104***-001')
    expect(m?.txDay).toBe('2026-06-13')
    expect(m?.paymentInstrument).toBe('account')
  })

  it('parses HSBC Phone Banking Transfer debit leg (-) as currency_exchange', () => {
    const body = '20JUN26 Phone Banking Transfer from 103-104***-110 USD 200.00- Your available balance is USD 2,172.73'
    const m = matchCuratedPattern(body, 'HSBC')
    expect(m?.patternId).toBe('hsbc-phone-banking-fx-debit')
    expect(m?.kind).toBe('currency_exchange')
    expect(m?.amount).toBe(200)
    expect(m?.currency).toBe('USD')
    expect(m?.counterparty).toBe('103-104***-110')
    expect(m?.txDay).toBe('2026-06-20')
  })

  it('HSBC Phone Banking Transfer without +/- falls back to instant_transfer_out', () => {
    const body = '13JUN26 Phone Banking Transfer to 103-104***-001 EGP 30,000.48 Your available balance is EGP 36,183.18'
    const m = matchCuratedPattern(body, 'HSBC')
    expect(m?.patternId).toBe('hsbc-phone-banking-transfer-out')
    expect(m?.kind).toBe('instant_transfer_out')
  })

  it('parses NBE Instapay card credit with empty/null sender (iOS bridge)', () => {
    // The iOS Shortcuts bridge sends sender as "" — must still match.
    for (const sender of ['', null] as const) {
      const m = matchCuratedPattern(NBE_IPN_IN_CARD, sender)
      expect(m?.patternId).toBe('nbe-ipn-in-card-ar')
      expect(m?.kind).toBe('instant_transfer_in')
      expect(m?.amount).toBe(2)
      expect(m?.currency).toBe('EGP')
      expect(m?.counterparty).toBe('MOHAMED MOUSSA ABDELLATIF')
      expect(m?.last4).toBe('6685')
      expect(m?.paymentInstrument).toBe('card')
      expect(m?.cleanTitle).toBe('Transfer from MOHAMED MOUSSA ABDELLATIF')
    }
  })
})

// Gulf (GCC) banks — verified real captures (pennywiseai fixtures). See
// docs/SMS_PATTERN_RESEARCH.md. Often arrive sender-less via the iOS bridge.
const ENBD_PURCHASE =
  'Purchase of AED 27.74 with Credit Card ending 9074 at Keeta, Dubai. Avl Cr. Limit is AED 30,978.13'
const ENBD_DEBIT =
  'AED 500.00 debited from A/C xxxx1234 on 24-Dec-25. Avl Bal is AED 15,234.50'
const ENBD_CREDIT =
  'AED 2,500.00 credited to A/C xxxx5678 on 24-Dec-25. Available Balance: AED 25,750.00'
const MASHREQ_PURCHASE =
  'Thank you for using NEO VISA Debit Card Card ending 1234 for AED 5.99 at CARREFOUR on 26-AUG-2025 10:25 PM. Available Balance is AED 1,480.15'
const SNB_POS =
  'شراء نقاط بيع SamsungPay\nبـSAR 19.45\nمن filwah al\nمدى *2342\nفي 07:53 03/04/26'

describe('Gulf (GCC) curated patterns', () => {
  it('parses Emirates NBD card purchase / account debit / account credit', () => {
    const p = matchCuratedPattern(ENBD_PURCHASE, 'EmiratesNBD')
    expect(p?.patternId).toBe('enbd-card-purchase-en')
    expect(p?.amount).toBe(27.74)
    expect(p?.currency).toBe('AED')
    expect(p?.last4).toBe('9074')
    expect(p?.counterparty).toBe('Keeta, Dubai')
    expect(p?.paymentInstrument).toBe('card')

    const d = matchCuratedPattern(ENBD_DEBIT, null)
    expect(d?.patternId).toBe('enbd-account-debit-en')
    expect(d?.amount).toBe(500)
    expect(d?.last4).toBe('1234')

    const c = matchCuratedPattern(ENBD_CREDIT, null)
    expect(c?.patternId).toBe('enbd-account-credit-en')
    expect(c?.kind).toBe('instant_transfer_in')
    expect(c?.amount).toBe(2500)
  })

  it('parses Mashreq NEO card purchase even sender-less', () => {
    const m = matchCuratedPattern(MASHREQ_PURCHASE, '')
    expect(m?.patternId).toBe('mashreq-card-purchase-en')
    expect(m?.amount).toBe(5.99)
    expect(m?.currency).toBe('AED')
    expect(m?.counterparty).toBe('CARREFOUR')
    expect(m?.last4).toBe('1234')
  })

  it('parses SNB AlAhli Arabic multi-line POS purchase', () => {
    const s = matchCuratedPattern(SNB_POS, 'SNB-AlAhli')
    expect(s?.patternId).toBe('snb-pos-purchase-ar')
    expect(s?.currency).toBe('SAR')
    expect(s?.amount).toBe(19.45)
    expect(s?.counterparty).toBe('filwah al')
    expect(s?.last4).toBe('2342')
  })
})

describe('pre-filter (non-transaction rejector)', () => {
  it('rejects telecom marketing that mentions money', () => {
    expect(isNonTransaction('Get 50GB for EGP 50! Renew your bundle now')).toBe('marketing')
    expect(isNonTransaction('عرض خاص! باقة 20 جنيه فقط اشترك الان')).toBe('marketing')
  })

  it('rejects OTPs', () => {
    expect(isNonTransaction('Your OTP is 123456. Do not share it with anyone.')).toBe('otp')
    expect(isNonTransaction('رمز التحقق الخاص بك هو 4821')).toBe('otp')
  })

  it('rejects balance-only inquiries', () => {
    expect(isNonTransaction('Your available balance is EGP 12,450.00')).toBe('balance_only')
  })

  it('NEVER rejects real transactions, even with marketing-ish words', () => {
    expect(isNonTransaction(HSBC_IPN_OUT)).toBeNull()
    expect(isNonTransaction(HSBC_IPN_IN)).toBeNull()
    expect(isNonTransaction(HSBC_PURCHASE)).toBeNull()
    // Transaction verb beats "bundle" vocabulary — a real renewal fee.
    expect(isNonTransaction('EGP 50.00 debited for bundle renewal')).toBeNull()
    expect(isNonTransaction('تم خصم 30 جنيه لتجديد الباقة')).toBeNull()
  })

  it('NEVER rejects SMS with a transaction amount even when a balance clause is appended', () => {
    // Root cause: HSBC phone banking transfers include "Your available balance is X"
    // at the end — the pre-filter was incorrectly treating this as a balance-only SMS.
    expect(isNonTransaction(HSBC_PHONE_BANKING_TRANSFER)).toBeNull()
    // Generic: any bank alert with trailing balance notation must pass.
    expect(isNonTransaction('You spent EGP 150.00 at Carrefour. Your available balance is EGP 5,000.00')).toBeNull()
    expect(isNonTransaction('AED 500.00 debited. Avl Bal is AED 15,234.50')).toBeNull()
  })

  it('passes Gulf transactions (English + Arabic) and rejects Gulf balance', () => {
    expect(isNonTransaction(ENBD_PURCHASE)).toBeNull()
    expect(isNonTransaction(ENBD_DEBIT)).toBeNull()
    expect(isNonTransaction(MASHREQ_PURCHASE)).toBeNull()
    expect(isNonTransaction(SNB_POS)).toBeNull()
    // Pure balance inquiry with Gulf phrasing → rejected.
    expect(isNonTransaction('الرصيد المتاح SAR 12,450.00')).toBe('balance_only')
  })
})

// --- Movement patterns (CC payoff / own transfer / FX) ----------------------
const CC_PAYOFF_THANKYOU =
  'Thank you. Your credit card payment of EGP 5,000.00 has been received.'
const CC_PAYOFF_RECEIVED =
  'Payment of EGP 3,200.00 received for your credit card ending 1234.'
const OWN_TRANSFER =
  'Transfer of EGP 1,000.00 from your account ****1234 to your account ****5678.'
const FX_DEBIT =
  'You have exchanged USD 100.00 from account ****1234.'
const FX_CREDIT =
  'Currency conversion: EGP 4,800.00 credited to account ****5678.'

describe('movement pattern matcher', () => {
  it('classifies a credit-card payoff (thank-you phrasing)', () => {
    const m = matchCuratedPattern(CC_PAYOFF_THANKYOU, null)
    expect(m).not.toBeNull()
    expect(m!.kind).toBe('cc_payoff')
    expect(m!.amount).toBe(5000)
    expect(m!.currency).toBe('EGP')
  })

  it('classifies a credit-card payoff with card last4', () => {
    const m = matchCuratedPattern(CC_PAYOFF_RECEIVED, null)
    expect(m).not.toBeNull()
    expect(m!.kind).toBe('cc_payoff')
    expect(m!.amount).toBe(3200)
    expect(m!.last4).toBe('1234')
  })

  it('classifies an own-account transfer and captures both account last4', () => {
    const m = matchCuratedPattern(OWN_TRANSFER, null)
    expect(m).not.toBeNull()
    expect(m!.kind).toBe('own_transfer')
    expect(m!.amount).toBe(1000)
    expect(m!.last4).toBe('1234')
    expect(m!.counterpartyLast4).toBe('5678')
  })

  it('classifies FX debit and credit legs as currency_exchange', () => {
    const debit = matchCuratedPattern(FX_DEBIT, null)
    expect(debit!.kind).toBe('currency_exchange')
    expect(debit!.currency).toBe('USD')
    expect(debit!.amount).toBe(100)

    const credit = matchCuratedPattern(FX_CREDIT, null)
    expect(credit!.kind).toBe('currency_exchange')
    expect(credit!.currency).toBe('EGP')
    expect(credit!.amount).toBe(4800)
  })

  it('does NOT misclassify a card purchase as a payoff', () => {
    const m = matchCuratedPattern(HSBC_PURCHASE, 'HSBC')
    expect(m!.kind).toBe('purchase')
  })
})
