import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeSmsHash, claimInProgressResponse, isClaimInFlight, maskOtpDigits, checkCreditSender, heldForConfirmation, nonTransactionReason, smsLocalDay, smsPlausibilityIssue, toSupportedCurrency, isStaleClaim, computeNeighbourSmsHashes, hasPostedTransaction,
} from './ingestGuards'
import { parseSmsDay, matchCuratedPattern } from './patterns'

describe('parseSmsDay year boundary', () => {
  it('a 01/01 SMS received 23:00 UTC on 31 Dec belongs to the new year', () => {
    expect(parseSmsDay('01/01', '2026-12-31T23:00:00Z')).toBe('2027-01-01')
    expect(parseSmsDay('31/12', '2027-01-01T08:00:00Z')).toBe('2026-12-31')
    expect(parseSmsDay('15/06', '2026-06-16T08:00:00Z')).toBe('2026-06-15')
  })
})

describe('computeSmsHash', () => {
  const body = 'Debited EGP 99.00 for NETFLIX'
  it('same body inside one bucket hashes the same (retry)', () => {
    expect(computeSmsHash(body, '2026-10-01T10:00:10Z')).toBe(computeSmsHash(body, '2026-10-01T10:00:50Z'))
  })
  it('same body a month later hashes differently', () => {
    expect(computeSmsHash(body, '2026-10-01T10:00:00Z')).not.toBe(computeSmsHash(body, '2026-11-01T10:00:00Z'))
  })
  it('no receivedAt falls back to body-only', () => {
    expect(computeSmsHash(body)).toBe(computeSmsHash('  debited egp 99.00   for netflix '))
  })
})

describe('smsLocalDay', () => {
  it('01:30 Cairo on the 1st stays on the 1st', () => {
    expect(smsLocalDay('2026-08-31T22:30:00Z')).toBe('2026-09-01')
  })
  it('honours an explicit timezone', () => {
    expect(smsLocalDay('2026-08-31T22:30:00Z', 'UTC')).toBe('2026-08-31')
  })
})

describe('smsPlausibilityIssue', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')
  it.each([-250, 0, NaN, Infinity, 5e9])('rejects amount %s', (a) => {
    expect(smsPlausibilityIssue(a, '2026-10-27', now)).toBe('implausible_amount')
  })
  it('rejects far-future and ancient days', () => {
    expect(smsPlausibilityIssue(10, '2026-12-01', now)).toBe('implausible_date')
    expect(smsPlausibilityIssue(10, '2024-01-01', now)).toBe('implausible_date')
  })
  it('accepts a normal SMS', () => {
    expect(smsPlausibilityIssue(99, '2026-10-26', now)).toBeNull()
  })
})

describe('toSupportedCurrency', () => {
  it('passes enum codes, uppercases, rejects unknown', () => {
    expect(toSupportedCurrency('usd')).toBe('USD')
    expect(toSupportedCurrency('TRY')).toBeNull()
    expect(toSupportedCurrency(null)).toBeNull()
  })
})

describe('isStaleClaim', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')
  it('takes over failed rows and old processing rows only', () => {
    expect(isStaleClaim('failed', '2026-10-27T11:59:59Z', now)).toBe(true)
    expect(isStaleClaim('processing', '2026-10-27T11:50:00Z', now)).toBe(true)
    expect(isStaleClaim('processing', '2026-10-27T11:59:30Z', now)).toBe(false)
    expect(isStaleClaim('confirmed', '2026-10-01T00:00:00Z', now)).toBe(false)
  })
})

describe('parseSmsDay validity', () => {
  it('rejects impossible calendar days', () => {
    expect(parseSmsDay('31-02-2026')).toBeNull()
    expect(parseSmsDay('31APR26')).toBeNull()
    expect(parseSmsDay('29/02/2028')).toBe('2028-02-29')
    expect(parseSmsDay('29/02/2027')).toBeNull()
  })
})

describe('nonTransactionReason (S11)', () => {
  const body = 'Your Credit Card ending with * 1234 has been used for EGP 150.00 on 27/05/2026 at VODAFONE BUNDLE OFFER. Your available limit is EGP 100.00'
  it('a curated match overrides the marketing/balance pre-filter', () => {
    const curated = matchCuratedPattern(body, null)
    expect(curated).not.toBeNull()
    expect(nonTransactionReason(body, !!curated)).toBeNull()
  })
  it('without a curated match the pre-filter still applies', () => {
    expect(nonTransactionReason('Your OTP is 123456. Do not share it.', false)).toBe('otp')
  })
})

describe('computeNeighbourSmsHashes', () => {
  const body = 'Debited EGP 99.00 for NETFLIX'
  it('two forwards straddling a bucket edge find each other through the neighbours', () => {
    const early = '2026-10-01T10:01:59Z'
    const late = '2026-10-01T10:02:01Z'
    expect(computeSmsHash(body, early)).not.toBe(computeSmsHash(body, late))
    expect(computeNeighbourSmsHashes(body, late)).toContain(computeSmsHash(body, early))
    expect(computeNeighbourSmsHashes(body, early)).toContain(computeSmsHash(body, late))
  })
  it('has no neighbours without a client timestamp', () => {
    expect(computeNeighbourSmsHashes(body)).toEqual([])
  })
})

describe('hasPostedTransaction', () => {
  const client = (rows: Record<string, unknown[]>) => ({
    from: (table: string) => {
      const q = { select: () => q, eq: () => q, limit: async () => ({ data: rows[table] ?? [] }) }
      return q
    },
  }) as never
  it('is true when an expense or income row references the log', async () => {
    expect(await hasPostedTransaction(client({ expenses: [{ id: 'e' }] }), 'u', 'l')).toBe(true)
    expect(await hasPostedTransaction(client({ income_events: [{ id: 'i' }] }), 'u', 'l')).toBe(true)
  })
  it('is false when nothing references it', async () => {
    expect(await hasPostedTransaction(client({}), 'u', 'l')).toBe(false)
  })
})

describe('N8/N12/N18/N3 ingest guards (masked fixtures)', () => {
  const body = 'Debited EGP 99.00 for SHOP'
  it('twin purchases with different event ids hash apart, a retry with the same id collapses', () => {
    const t = '2026-10-01T10:00:10Z'
    expect(computeSmsHash(body, t, 'evt-a')).not.toBe(computeSmsHash(body, t, 'evt-b'))
    expect(computeSmsHash(body, t, 'evt-a')).toBe(computeSmsHash(body, '2026-10-01T10:09:00Z', 'evt-a'))
    expect(computeNeighbourSmsHashes(body, t, 'evt-a')).toEqual([])
  })
  it('claim in flight answers 409 retry, never a 2xx', async () => {
    const res = claimInProgressResponse()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ retry: true })
    expect(isClaimInFlight('processing')).toBe(true)
    expect(isClaimInFlight('confirmed')).toBe(false)
  })
  it('masks OTP digit runs', () => {
    expect(maskOtpDigits('Code 123456 for card 9999')).toBe('Code # for card #')
  })
  it('credit sender: mismatch only when a sender is present', () => {
    expect(checkCreditSender('CIB', 'instant_transfer_in', 'CIB')).toBe('ok')
    expect(checkCreditSender('CIB', 'instant_transfer_in', 'RANDOM-X')).toBe('mismatch')
    expect(checkCreditSender('CIB', 'instant_transfer_in', '')).toBe('absent')
    expect(checkCreditSender('CIB', 'instant_transfer_in', null)).toBe('absent')
    expect(checkCreditSender('CIB', 'instant_transfer_in', 'CIB-EG')).toBe('ok')
    expect(checkCreditSender('CIB', 'instant_transfer_in', 'cib eg')).toBe('ok')
    expect(checkCreditSender('CIB', 'instant_transfer_in', 'CIBFAKE')).toBe('mismatch')
    expect(checkCreditSender('CIB', 'purchase', 'RANDOM-X')).toBe('ok')
  })
  it('credit sender: a bank with no sender ids of its own accepts any known bank sender and holds an unknown one', () => {
    // generic sets (Bank / Credit Card / Transfer / Currency Exchange) and banks only a template or the AI knows
    expect(checkCreditSender('Bank', 'income', 'ANY')).toBe('mismatch')
    expect(checkCreditSender('Credit Card', 'income', 'SPOOF-X')).toBe('mismatch')
    expect(checkCreditSender('Transfer', 'instant_transfer_in', 'FREE-GIFT')).toBe('mismatch')
    expect(checkCreditSender(null, 'income', 'FREE-GIFT')).toBe('mismatch')
    expect(checkCreditSender('Bank', 'income', 'CIB')).toBe('ok')
    expect(checkCreditSender('Bank Misr', 'income', 'HSBC')).toBe('ok')
    expect(checkCreditSender('Bank', 'income', '')).toBe('absent')
    expect(checkCreditSender('Bank', 'purchase', 'SPOOF-X')).toBe('ok')
  })
  it('held credit posts nothing', () => {
    expect(heldForConfirmation('income')).toMatchObject({ outcome: 'awaiting_confirmation', expenseId: null, incomeId: null })
  })
})
