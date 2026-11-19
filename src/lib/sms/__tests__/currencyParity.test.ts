import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENCY_CODES } from '../patterns/currency'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const latinCodes = (list: string): Set<string> =>
  new Set(list.replace(/\\+\.\?/g, '').split(/[|",\s]+/).filter((t) => /^[a-z]{2,3}$/.test(t)))

const gates: Record<string, Set<string>> = {
  'deviceOtpGate.ts': latinCodes(/const CCY = '([^']+)'/.exec(read('src/lib/sms/deviceOtpGate.ts'))![1]),
  'SmsGate.kt': latinCodes(/"egp"(?:\s*,\s*"[^"]*")+/.exec(read('android/app/src/main/java/app/buddget/SmsGate.kt'))![0]),
  'CatchBankSmsIntent.swift': latinCodes(/egp(?:\|[^|)"]*)+/.exec(read('ios/App/App/CatchBankSmsIntent.swift').split('static let currency')[1]!)![0]),
}

describe('currency list parity (N10 parity)', () => {
  const required = [...CURRENCY_CODES.map((c) => c.toLowerCase()), 'sr', 'le']

  it('the three device gates carry the same Latin codes', () => {
    const [first, ...rest] = Object.entries(gates)
    for (const [name, set] of rest) {
      const missing = [...first![1]].filter((c) => !set.has(c))
      const extra = [...set].filter((c) => !first![1].has(c))
      expect({ name, missing, extra }).toEqual({ name, missing: [], extra: [] })
    }
  })

  it.each(Object.entries(gates))('%s covers every shared code plus SR and LE', (name, set) => {
    expect({ name, missing: required.filter((c) => !set.has(c)) }).toEqual({ name, missing: [] })
  })
})

describe('QA-105: the dotted Egyptian pound "ج.م"', () => {
  it('is a currency token', async () => {
    const { hasCurrencyToken } = await import('../patterns/currency')
    expect(hasCurrencyToken('تم خصم 250 ج.م من حسابك')).toBe(true)
    expect(hasCurrencyToken('تم خصم 250 ج. م من حسابك')).toBe(true)
  })
  it('counts as a transaction amount for the pre-filter', async () => {
    const { isNonTransaction } = await import('../patterns/preFilter')
    expect(isNonTransaction('تم خصم 250 ج.م من حسابك. الرصيد المتاح 1000 ج.م')).toBeNull()
  })
})
