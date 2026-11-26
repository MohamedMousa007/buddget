import { describe, expect, it } from 'vitest'
import { providerFromBody } from './providerFromBody'
import { detectHotline } from './routingKey'

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
  it('a wallet that is also a payer or a merchant (Deel, Ziina, Skrill) never names the sender of a bank SMS', () => {
    expect(name('Salary credit from DEEL INC EGP 25,000.00 to your account')).toBeNull()
    expect(name('Purchase at ZIINA*shop AED 40.00 on card 4821')).toBeNull()
    expect(name('Card 4821 charged USD 20.00 at SKRILL.COM')).toBeNull()
    expect(name('From HSBC: Salary credit from DEEL INC EGP 25,000.00')).toBe('HSBC Egypt')
  })
  it('takes the provider named first, and ignores random 5-digit numbers', () => {
    expect(name('NBE transfer to CIB account EGP 100')).toBe('NBE')
    expect(name('Ref 12345 EGP 40 at SHOP')).toBeNull()
  })
})

describe('P2-9: a hotline number that is money names no bank', () => {
  it.each(['Paid EGP 19700 at SHOP', 'Paid 19700.00 at SHOP', 'Paid 19,700 at SHOP', 'Paid 19700 EGP at SHOP', 'Paid LE 19666', 'Paid 1,19666 at SHOP', 'دفع ١٩٧٠٠٫٥٠ جنيه'])('%s', (body) => {
    expect(detectHotline(body)).toBeNull()
    expect(providerFromBody(body)).toBeNull()
  })
  it.each([['call 19666', 'HOTLINE-19666'], ['اتصل 19666', 'HOTLINE-19666'], ['Paid EGP 50 at SHOP. Help: 19700.', 'HOTLINE-19700']])('%s still names the bank', (body, key) => {
    expect(detectHotline(body)).toBe(key)
    expect(providerFromBody(body)?.via).toBe('hotline')
  })
  it('a money hotline-lookalike does not hide a real hotline later in the body', () => {
    expect(detectHotline('Paid EGP 19700 at SHOP, call 19666')).toBe('HOTLINE-19666')
  })
})
