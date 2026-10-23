import { describe, expect, it } from 'vitest'
import { providerFromBody } from './providerFromBody'

const name = (m: string) => providerFromBody(m)?.name ?? null

describe('providerFromBody', () => {
  it.each([
    ['From HSBC: 22JUL26 ELWAHAT FOR PETROLEM Purchase from 103-104***-001 EGP 715.00- Your available balance is EGP 3,571.53', 'HSBC Egypt'],
    ['تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه.', 'Vodafone Cash'],
    ['CIB: Your card #2016 was charged EGP 20.00 at ****.COM', 'CIB'],
    ['Your card was charged EGP 20.00. For help call 19666', 'CIB'],
    ['تم خصم EGP 12.75 من بطاقة الخصم المباشر. للاستفسار 19623', 'NBE'],
    ['Barq: Adding money to account Amount: 400 SAR', 'Barq'],
  ])('%#', (body, expected) => expect(name(body)).toBe(expected))

  it('does not name a bank from a scheme, a rail or a merchant that shares a name', () => {
    expect(name('Purchase of EGP 50 at Vodafone store via Visa')).toBeNull()
    expect(name('تم الدفع باستخدام Apple Pay عند KAZYON')).toBeNull()
    expect(name('Your Mastercard was charged EGP 10 at Starbucks')).toBeNull()
    expect(name('Order from Fawry shop EGP 30')).toBeNull()
  })
  it('takes the provider named first, and ignores random 5-digit numbers', () => {
    expect(name('NBE transfer to CIB account EGP 100')).toBe('NBE')
    expect(name('Ref 12345 EGP 40 at SHOP')).toBeNull()
  })
})
