import { describe, expect, it } from 'vitest'
import { looksMultiTransaction } from './multiAmount'

describe('looksMultiTransaction (QA-32)', () => {
  it('two statements of one template in one message', () => {
    expect(looksMultiTransaction('Account ***3307 was debited EGP 100.00 for purchase at UBER on 16-11-2026 08:00. Account ***3307 was debited EGP 250.00 for purchase at STARBUCKS on 16-11-2026 08:30')).toBe(true)
  })

  it('two statements on separate lines, each with its balance clause', () => {
    expect(looksMultiTransaction('Card **1234 purchase SAR 20.00 at CAFE, available balance SAR 500.00\nCard **1234 purchase SAR 35.00 at DELI, available balance SAR 465.00')).toBe(true)
  })

  it('one movement and its balance line is one statement', () => {
    expect(looksMultiTransaction('Your HSBC Account ****0001 was debited EGP 250.00 for purchase at Carrefour Egypt on 09-06-2026. Your available balance is EGP 3,571.53')).toBe(false)
  })

  it('a movement and a fee in other words is one statement', () => {
    expect(looksMultiTransaction('Account ***3307 was debited EGP 100.00 for transfer to A. A fee of EGP 5.00 was debited.')).toBe(false)
  })

  it('an Arabic single movement', () => {
    expect(looksMultiTransaction('تم خصم EGP 12.75 من بطاقة الخصم المباشر # **6212 عند KAZYON في 07/07/26 17:16 الرصيد المتاح EGP3957.91.')).toBe(false)
  })
})
