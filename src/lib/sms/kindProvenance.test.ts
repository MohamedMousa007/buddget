import { describe, expect, it } from 'vitest'
import { plainKindForModelOwnTransfer, plainKindForModelRepayment, repaymentWording } from './kindProvenance'

/** P1-7: wording, not registration, decides whether a model-asserted repayment is spending. Invented messages only. */

describe('repaymentWording', () => {
  it('paid into the card: the card is where the money went', () => {
    expect(repaymentWording('An amount of EGP 1,724.00 was paid into your credit card ending 1234')).toBe('paid_into_card')
    expect(repaymentWording('Payment of SAR 500 credited to your card')).toBe('paid_into_card')
  })

  it('via card: the card is the instrument', () => {
    expect(repaymentWording('Payment of SAR 950.00 via card ••1234 to SAMPLE SHOP')).toBe('card_as_instrument')
    expect(repaymentWording('You paid AED 40 via credit card')).toBe('card_as_instrument')
  })

  it('Arabic: a repayment word then "into your card", or then "via" and a masked card tail', () => {
    expect(repaymentWording('تم سداد مبلغ 500 ريال في بطاقتك')).toBe('paid_into_card')
    expect(repaymentWording('تم سداد 950 ريال عبر ****1234 لدى متجر')).toBe('card_as_instrument')
    expect(repaymentWording('تم دفع 950 ريال عبر 1234')).toBe('card_as_instrument')
  })

  it('neither wording is null, and "into the card" wins when both appear', () => {
    expect(repaymentWording('Credit card payment received')).toBeNull()
    expect(repaymentWording('Payment paid via card then credited to your card')).toBe('paid_into_card')
  })

  it('only the card-as-instrument wording makes a model-asserted repayment spending', () => {
    expect(plainKindForModelRepayment('Payment of SAR 950.00 via card ••1234')).toBe('purchase')
    expect(plainKindForModelRepayment('An amount was paid into your card')).toBeNull()
    expect(plainKindForModelRepayment('Card payment received')).toBeNull()
  })
})

describe('plainKindForModelOwnTransfer', () => {
  it('reads the direction the message shows: credit is a transfer in, anything else a transfer out', () => {
    expect(plainKindForModelOwnTransfer('EGP 300.00+ transfer')).toBe('instant_transfer_in')
    expect(plainKindForModelOwnTransfer('EGP 300.00- transfer')).toBe('instant_transfer_out')
    expect(plainKindForModelOwnTransfer('Transfer of EGP 300')).toBe('instant_transfer_out')
  })
})
