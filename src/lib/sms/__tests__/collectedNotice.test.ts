import { describe, expect, it } from 'vitest'
import { isCollectedNotice } from '../collectedNotice'
import { isNonTransaction } from '../patterns/preFilter'
import { nonTransactionReason } from '../ingestGuards'

describe('isCollectedNotice (S2c step 8a, I3)', () => {
  it.each([
    'Your transfer of EGP 1,500.00 to Sample Receiver has been collected by the beneficiary on 12/11.',
    'Dear customer, the remittance was picked up by the recipient today.',
    'The money transfer you sent has been collected. Thank you for using our service.',
    'Transfer ref 55021 received by the beneficiary at branch 3.',
    'The recipient has picked up your transfer of USD 200.',
    'تم استلام الحوالة من قبل المستفيد بمبلغ 1500 جنيه',
    'تم صرف التحويل للمستلم بنجاح',
  ])('true: %s', (text) => expect(isCollectedNotice(text)).toBe(true))

  it.each([
    'EGP 1,500.00 was credited to your account from a transfer. Balance EGP 9,000.00',
    'Transfer received in your account: USD 200 deposited into your account',
    'تم إيداع 1500 جنيه في حسابك من تحويل',
    'تم استلام تحويل بمبلغ 500 جنيه إلى حسابك',
    'Debited EGP 300.00 for transfer to beneficiary, was received by the beneficiary',
    'Your parcel was collected from the locker',
    'Instant transfer of EGP 100 to a friend was successful',
  ])('false: %s', (text) => expect(isCollectedNotice(text)).toBe(false))
})

describe('pre-filter verdict', () => {
  const notice = 'Your transfer of EGP 1,500.00 has been collected by the beneficiary.'
  it('rejects the notice with its own reason, before the transaction-verb override', () => {
    expect(isNonTransaction(notice)).toBe('collected_notice')
  })
  it('a template match cannot skip it: only a code pattern match does', () => {
    expect(nonTransactionReason(notice, false)).toBe('collected_notice')
    expect(nonTransactionReason(notice, true)).toBeNull()
  })
  it('a credit that mentions a transfer still reaches the tiers', () => {
    expect(isNonTransaction('EGP 1,500.00 credited to your account, transfer from Sample Sender')).toBeNull()
  })
})
