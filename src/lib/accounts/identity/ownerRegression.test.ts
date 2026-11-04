import { describe, expect, it } from 'vitest'
import { resolveReportTarget } from '@/lib/sms/balanceReport'
import { extractAccountTail, matchByTail } from './accountRef'

const m = (o: object) => ({ id: 'x', name: 'x', type: 'bank_account', last4: null, currency: 'EGP', parent_id: null, track_sms: true, closed_at: null, ...o })
const owner = [
  m({ id: 'usd', name: 'HSBC Egypt ••0110', last4: '0110', currency: 'USD' }),
  m({ id: 'cib', name: 'CIB ••2000', last4: '2000' }),
  m({ id: 'card', name: 'HSBC Egypt', type: 'debit_card', parent_id: 'egp' }),
  m({ id: 'egp', name: 'HSBC Egypt ••0001', last4: '0001' }),
]

describe('the reported HSBC messages resolve to the EGP account', () => {
  it.each([
    'EL UP OCTOBER Purchase from 103-104***-001 EGP 925.00- Your available balance is EGP 598.99',
    'PETROLEM Purchase from 103-104***-001 EGP 765.00- Your available balance is EGP 4,270.17',
    'CT99 ATM Cash Withdrawal from 103-104***-001 EGP 1,000.00- Your available balance is EGP 3,270.17',
    'MCDONALDS ARKAN Purchase from 103-104***-001 EGP 485.00- Your available balance is EGP 2,785.17',
    'Talabat Purchase from 103-104***-001 EGP 249.24- Your available balance is EGP 2,075.43',
  ])('%s', (body) => {
    const tail = extractAccountTail(body)
    expect(tail).toBe('001')
    expect(matchByTail(owner, tail)).toEqual({ id: 'egp', ambiguous: false })
    expect(resolveReportTarget(owner, tail, { bankName: 'HSBC Egypt' }, 'EGP')?.id).toBe('egp')
  })
})

describe('every visible length of a saved number resolves to its own account', () => {
  const saved = ['0001', '0110', '5950', '2000', '123456', '40507']
  const methods = saved.map((d) => ({ id: d, last4: d }))
  it('2 to 6 trailing digits find exactly the account that ends that way, or none when two do', () => {
    for (const d of saved) {
      for (let k = 3; k <= Math.min(6, d.length); k++) {
        const tail = d.slice(-k)
        const fits = saved.filter((o) => o.endsWith(tail) || tail.endsWith(o))
        const r = matchByTail(methods, tail)
        if (fits.length === 1) expect(r).toEqual({ id: d, ambiguous: false })
        else expect(r.id === null || r.id === d).toBe(true)
      }
    }
  })
  it('a wrong tail never resolves to an account that does not end with it', () => {
    for (let n = 0; n < 2000; n++) {
      const tail = String(n).padStart(4, '0')
      const r = matchByTail(methods, tail)
      if (r.id) expect(r.id.endsWith(tail) || tail.endsWith(r.id)).toBe(true)
    }
  })
})
