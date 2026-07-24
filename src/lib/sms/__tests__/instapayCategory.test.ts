import { describe, it, expect } from 'vitest'
import { mapKindToCategory, isEgyptianInstapay } from '../createSmsExpense'

const HSBC_IPN =
  'Your HSBC Account ********0001 was debited with IPN outward transfer for EGP 300.50 on 13-07-2026 to IBRAHIM AHMED with reference ad7ac987.'
const CIB_IPN_AR =
  'يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 230.00 جم من حسابك المنتهي بـ ********3704 برقم مرجعي 99840398'
const INTL_WIRE =
  'Wire transfer of USD 500.00 sent to JOHN SMITH via SWIFT. Ref 12345.'

describe('isEgyptianInstapay', () => {
  it('recognises the English IPN marker', () => {
    expect(isEgyptianInstapay(HSBC_IPN)).toBe(true)
  })
  it('recognises the Arabic instant-transfer marker', () => {
    expect(isEgyptianInstapay(CIB_IPN_AR)).toBe(true)
  })
  it('does not fire on an international wire', () => {
    expect(isEgyptianInstapay(INTL_WIRE)).toBe(false)
  })
  it('is safe on empty input', () => {
    expect(isEgyptianInstapay(null)).toBe(false)
    expect(isEgyptianInstapay('')).toBe(false)
  })
})

describe('mapKindToCategory — Instapay routing', () => {
  it('labels an Egyptian IPN send as Instapay', () => {
    expect(mapKindToCategory('instant_transfer_out', null, HSBC_IPN)).toBe('Instapay')
    expect(mapKindToCategory('instant_transfer_out', null, CIB_IPN_AR)).toBe('Instapay')
  })

  it('keeps a non-IPN / international send as Remittance', () => {
    expect(mapKindToCategory('instant_transfer_out', null, INTL_WIRE)).toBe('Remittance')
    // No body available at all → conservative default (Remittance, unchanged behaviour).
    expect(mapKindToCategory('instant_transfer_out', null)).toBe('Remittance')
  })

  it('leaves own-account transfers as the non-spend Transfer, even with an IPN body', () => {
    // own_transfer is settled before categorisation; an IPN body must not flip it to a spend category.
    expect(mapKindToCategory('own_transfer', null, HSBC_IPN)).toBe('Transfer')
  })

  it('does not touch purchase categorisation', () => {
    expect(mapKindToCategory('purchase', 'food', HSBC_IPN)).toBe('Food')
    expect(mapKindToCategory('purchase', null)).toBe('Other')
  })
})
