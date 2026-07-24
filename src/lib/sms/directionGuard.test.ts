import { describe, it, expect } from 'vitest'
import { detectLedgerSign, guardDirection } from './directionGuard'

// Real captured SMS (sms_parse_log, July 2026) — the statement family HSBC Egypt sends.
const TT_CREDIT =
  'From HSBC: 20JUL26 TT Payment to 103-104***-110 USD 3,097.24+ Your available balance is USD 7,546.11'
const POS_DEBIT =
  'From HSBC: 17JUL26 VODAFONE EGYPT Purchase from 103-104***-001 EGP 250.00- Your available balance is EGP 6,354.53'
const FX_CREDIT_LEG =
  'From HSBC: 15JUL26 Phone Banking Transfer to 103-104***-001 EGP 14,956.88+ Your available balance is EGP 18,616.53'
const IPN_IN =
  'Your HSBC Account ********0001 was credited with IPN inward transfer for EGP 130.00 on 20-07-2026 21:18 from HUSSEIN OSAMA with reference 2d20b4e9.'
const IPN_OUT =
  'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 2,002.00 on 23-07-2026 18:33 to Cib Credit with reference b1a568e0.'
const REVERSAL =
  'Your HSBC Account ********0001 was reversed with IPN outward transfer for EGP 1.50 on 03-07-2026 05:32 from MOHAMED MOUSSA with reference 35692982.'

describe('detectLedgerSign', () => {
  it('reads the trailing + as a credit', () => {
    expect(detectLedgerSign(TT_CREDIT)).toBe('credit')
  })

  it('reads the trailing - as a debit', () => {
    expect(detectLedgerSign(POS_DEBIT)).toBe('debit')
  })

  it('is silent on messages that carry no sign', () => {
    expect(detectLedgerSign(IPN_IN)).toBeNull()
    expect(detectLedgerSign(IPN_OUT)).toBeNull()
  })

  it('never reads a date, masked account or reference as a debit marker', () => {
    // "20-07-2026", "103-104***-110" and hex refs all contain hyphens next to digits.
    expect(detectLedgerSign('Transfer on 20-07-2026 to 103-104***-110 ref b1a568e0 EGP 500.00')).toBeNull()
  })

  it('refuses to decide when a message carries both signs', () => {
    expect(detectLedgerSign('EGP 100.00+ then EGP 40.00- later')).toBeNull()
  })
})

describe('guardDirection', () => {
  it('rescues the credit the AI booked as an outgoing transfer (the 3,097 USD salary)', () => {
    expect(guardDirection('instant_transfer_out', TT_CREDIT)).toBe('instant_transfer_in')
  })

  it('rescues a credit mislabelled as a purchase', () => {
    expect(guardDirection('purchase', TT_CREDIT)).toBe('instant_transfer_in')
  })

  it('rescues a debit mislabelled as income', () => {
    expect(guardDirection('income', POS_DEBIT)).toBe('instant_transfer_out')
  })

  it('leaves an already-correct kind alone', () => {
    expect(guardDirection('purchase', POS_DEBIT)).toBe('purchase')
    expect(guardDirection('income', TT_CREDIT)).toBe('income')
  })

  it('leaves two-leg kinds alone — each leg carries its own sign', () => {
    expect(guardDirection('currency_exchange', FX_CREDIT_LEG)).toBe('currency_exchange')
    expect(guardDirection('own_transfer', POS_DEBIT)).toBe('own_transfer')
  })

  it('does not touch a reversal, whose verb inverts and whose amount is unsigned', () => {
    expect(guardDirection('refund', REVERSAL)).toBe('refund')
  })

  it('passes through when the message carries no sign', () => {
    expect(guardDirection('instant_transfer_out', IPN_OUT)).toBe('instant_transfer_out')
    expect(guardDirection('instant_transfer_in', IPN_IN)).toBe('instant_transfer_in')
  })
})
