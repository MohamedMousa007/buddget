import { describe, expect, it } from 'vitest'
import { isNonTransaction } from '../preFilter'

describe('a real transfer receipt that ends with a promo line is still a transaction', () => {
  it('a completed wallet transfer with a fee, balance and a prize trailer reaches the parsers', () => {
    const body = '5000 L.E were successfully transferred to 01012345678 the transfer fee is 5 LE, your current Vodafone Cash balance is 1234.5 L.E. Transaction date: 2026-10-01 10:00 Trx ID 123456. Transfer money to any wallet and get a chance to win a gold coin!'
    expect(isNonTransaction(body)).toBeNull()
  })
  it('the same trailer on a message with no amount, or an ad about transfers, is still marketing', () => {
    expect(isNonTransaction('Transfer money to any wallet and get a chance to win a gold coin!')).toBe('marketing')
    expect(isNonTransaction('حول فلوسك بفودافون كاش وممكن تكسب كاش باك لحد 50 جنيه! للتحويل زور http://vf.eg/x')).toBe('marketing')
    expect(isNonTransaction('تم تحويل 500 ميجا بنجاح من 01012345678')).toBeNull()
  })
})
