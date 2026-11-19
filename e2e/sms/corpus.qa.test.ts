/**
 * QA Session 03 driver: runs the adversarial corpus (fixtures/corpus.json) through the REAL code of the ingest
 * pipeline's pure stages (normalisation, pre-filter, curated tier, dedupe identity, second-copy verdict, day
 * resolution, correction exemplar). Results go to e2e/sms/out/results.json for the report.
 *
 * Run: npx vitest run --config e2e/sms/vitest.config.ts
 */
import { describe, it, expect, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import corpus from './fixtures/corpus.json'
import { normalizeSmsText } from '@/lib/sms/normalizeDigits'
import { matchCuratedPattern } from '@/lib/sms/patterns'
import {
  computeSmsHash, computeNeighbourSmsHashes, computeBodyHash, captureSecond, nonTransactionReason, resolveSmsDay, smsLocalDay,
} from '@/lib/sms/ingestGuards'
import { secondCopyVerdict, standingCopies } from '@/lib/sms/captureGuard'
import { extractIpnReference } from '@/lib/sms/dispatch'
import { extractBalance } from '@/lib/sms/balanceReport'
import { formatCorrectionExemplar } from '@/lib/sms/correctionExemplar'
import { decideOwnTransfer } from '@/lib/sms/ownTransferDecision'

type Expect = {
  kind?: string | null; kindNot?: string; amount?: number; currency?: string; last4?: string; cpLast4?: string; day?: string
  reject?: string; secondDropped?: boolean
}
type Row = { id: string; title: string; pass: boolean; actual: unknown; expected: Expect; note?: string }
const results: Row[] = []

afterAll(() => {
  const out = path.join(__dirname, 'out')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
})

describe('corpus: pre-filter + curated tier', () => {
  for (const c of corpus.cases as Array<{ id: string; title: string; sender: string; body: string; receivedAt?: string; expect: Expect }>) {
    it(`${c.id} ${c.title}`, () => {
      const receivedAt = c.receivedAt ?? corpus.receivedAt
      const message = normalizeSmsText(c.body)
      const curated = matchCuratedPattern(message, c.sender, receivedAt)
      const reject = nonTransactionReason(message, !!curated)
      const actual = {
        reject, kind: curated?.kind ?? null, patternId: curated?.patternId ?? null, amount: curated?.amount ?? null,
        currency: curated?.currency ?? null, last4: curated?.last4 ?? null, cpLast4: curated?.counterpartyLast4 ?? null, day: curated?.txDay ?? null,
      }
      const e = c.expect
      const checks: boolean[] = []
      if (e.reject !== undefined) checks.push(reject === e.reject && !curated)
      else checks.push(reject === null)
      if (e.kind !== undefined) checks.push(actual.kind === e.kind)
      if (e.kindNot !== undefined) checks.push(actual.kind !== e.kindNot)
      if (e.amount !== undefined) checks.push(actual.amount === e.amount)
      if (e.currency !== undefined) checks.push(actual.currency === e.currency)
      if (e.last4 !== undefined) checks.push(actual.last4 === e.last4)
      if (e.cpLast4 !== undefined) checks.push(actual.cpLast4 === e.cpLast4)
      if (e.day !== undefined) checks.push(actual.day === e.day)
      // Two transactions in one message: the curated tier returns ONE match; the second movement has nowhere to go.
      if (e.secondDropped) checks.push(false)
      const pass = checks.every(Boolean)
      results.push({ id: c.id, title: c.title, pass, actual, expected: e })
      expect(actual).toBeDefined()
    })
  }
})

const PURCHASE = 'Your CIB credit card ending with#4821 was charged for EGP 45.00 at STARBUCKS ZAMALEK on 16/11/26'
const record = (id: string, title: string, pass: boolean, actual: unknown, note?: string) =>
  results.push({ id, title, pass, actual, expected: {}, note })

describe('dedupe identity', () => {
  it('D01 same capture retried (same eventId) collapses', () => {
    const ev = '8f9b7f2e-3a51-4f0e-9b3a-2f8a1c0d9e11'
    const a = computeSmsHash(PURCHASE, '2026-11-16T10:00:00+02:00', ev)
    const b = computeSmsHash(PURCHASE, '2026-11-16T10:00:00+02:00', ev)
    record('D01', 'Same SMS delivered twice (retry, same capture id)', a === b, { sameHash: a === b })
  })

  it('D02 Android double broadcast: same SMS, two capture ids, 20 s apart, no reference/balance', () => {
    const verdict = secondCopyVerdict({ hasReference: extractIpnReference(PURCHASE) != null, hasBalance: extractBalance(PURCHASE) != null })
    // possible_duplicate = the second copy is BOOKED (flagged), not dropped.
    record('D02', 'Same SMS delivered twice under two capture ids (no ref/balance)', verdict !== 'possible_duplicate', { verdict },
      'Second copy is booked as a second expense with a possible_duplicate flag')
  })

  it('D03 same SMS delivered 3 times under three capture ids', () => {
    // Rows 1 and 2 are both live (2 was booked as possible_duplicate); copy 3 sees them, same verdict -> books a third.
    const verdict = secondCopyVerdict({ hasReference: false, hasBalance: false })
    record('D03', 'Same SMS delivered 3 times (three capture ids)', verdict !== 'possible_duplicate', { verdict, booked: 3 })
  })

  it('D04 QNB-style body with balance delivered twice -> proven duplicate', () => {
    const body = 'Your Debit Card ***9044 had a Successful transaction of EGP 615.75 @ TALABAT CAIRO, your available balance is EGP 12,450.10'
    const verdict = secondCopyVerdict({ hasReference: extractIpnReference(body) != null, hasBalance: extractBalance(body) != null })
    record('D04', 'Same SMS with balance twice (two capture ids)', verdict === 'proven_duplicate', { verdict })
  })

  it('D05 twin purchases 3 min apart, client sends NO eventId (legacy / manual source)', () => {
    // 2-minute buckets: 10:00:00-10:01:59 is bucket N, 10:02:00-10:03:59 is N+1. The two captures are 3m40s apart.
    const t1 = '2026-11-16T10:00:10+02:00'
    const t2 = '2026-11-16T10:03:50+02:00'
    const h1 = computeSmsHash(PURCHASE, t1)
    const neighboursOf2 = computeNeighbourSmsHashes(PURCHASE, t2)
    const dropped = neighboursOf2.includes(h1) || computeSmsHash(PURCHASE, t2) === h1
    record('D05', 'Two real purchases, same amount+merchant, 3m40s apart, no capture id', !dropped, { secondAnsweredDuplicate: dropped },
      'route.ts:761-773 neighbour-bucket check answers duplicate:true before the I5 book-and-flag path')
  })

  it('D06 twin purchases minutes apart WITH distinct eventIds', () => {
    const verdict = secondCopyVerdict({ hasReference: false, hasBalance: false })
    record('D06', 'Two real purchases, same amount+merchant, minutes apart, two capture ids', verdict === 'possible_duplicate', { verdict, bothBook: true })
  })

  it('D07 same reference, different amounts -> different bodies, no ingest dedupe', () => {
    const a = 'Account ***3307 was debited with IPN outward transfer for EGP 4,000.00 on 16-11-2026 09:15 to QA X with reference 77AB12CD34'
    const b = 'Account ***3307 was debited with IPN outward transfer for EGP 400.00 on 16-11-2026 09:15 to QA X with reference 77AB12CD34'
    const pass = computeBodyHash(a) !== computeBodyHash(b) && extractIpnReference(a) === extractIpnReference(b)
    record('D07', 'Same reference, different amounts', pass, { bodiesDiffer: computeBodyHash(a) !== computeBodyHash(b), ref: extractIpnReference(a) })
  })

  it('D08 out-of-order: later capture booked first; earlier capture arrives second', () => {
    const self = { id: 'b', received_at: '2026-11-16T10:00:00.000Z', captured_at: '2026-11-16T10:00:00.000Z' }
    const rows = [{ id: 'a', status: 'parsed', received_at: '2026-11-16T10:01:00.000Z', captured_at: '2026-11-16T10:01:00.000Z', expense_id: 'x', income_id: null }]
    const standing = standingCopies(self, rows)
    record('D08', 'Out-of-order delivery of the same text', standing.length === 1, { standing: standing.map((r) => r.id) })
  })
})

describe('day resolution (Africa/Cairo)', () => {
  it('T01 delayed delivery across midnight: printed date wins', () => {
    const r = resolveSmsDay({ bodyDay: '2026-11-30', captureDay: smsLocalDay('2026-11-30T22:30:00Z'), arrivalDay: '2026-12-01', nowMs: Date.parse('2026-12-01T08:00:00Z') })
    record('T01', 'Delivered next day across month end, body dated 30/11', r.day === '2026-11-30', r)
  })
  it('T02 no printed date, captured 23:59 Cairo on 30 Nov, posted 00:05', () => {
    const captureDay = smsLocalDay('2026-11-30T21:59:00Z', 'Africa/Cairo')
    const r = resolveSmsDay({ bodyDay: null, captureDay, arrivalDay: '2026-12-01', nowMs: Date.parse('2026-11-30T22:05:00Z') })
    record('T02', 'No printed date, capture 23:59 Cairo, arrival 00:05', r.day === '2026-11-30', r)
  })
  it('T03 capture second floor', () => {
    record('T03', 'captureSecond is stable across retries', captureSecond('2026-11-16T10:00:00.900+02:00') === captureSecond('2026-11-16T10:00:00.100+02:00'), {})
  })
})

describe('own-transfer decision (pure)', () => {
  it('O01 HSBC IPN out + in, same device, same reference, different accounts -> settle', () => {
    const d = decideOwnTransfer({ differentAccounts: true, sameAccount: false, sameDevice: true, amountsEqual: true, withinFee: true, sameReference: true, sameCounterpartyHash: false, counterpartyIsOwnAccount: false, counterpartyIsProfileName: false, answered: null })
    record('O01', 'Own transfer A->B, two SMS with shared reference, same phone', d.verdict === 'settle', d)
  })
  it('O02 CIB AR out (no name) + NBE AR in (sender name), same device, refs differ, accounts not registered -> ?', () => {
    const d = decideOwnTransfer({ differentAccounts: true, sameAccount: false, sameDevice: true, amountsEqual: true, withinFee: true, sameReference: false, sameCounterpartyHash: false, counterpartyIsOwnAccount: false, counterpartyIsProfileName: true, answered: null })
    record('O02', 'Own transfer A->B across banks, no shared ref, profile name matches', d.verdict === 'settle', d,
      'verdict ask: spend + income both booked until the user answers')
  })
  it('O03 two legs captured on different devices (iPhone + Android) -> ?', () => {
    const d = decideOwnTransfer({ differentAccounts: true, sameAccount: false, sameDevice: false, amountsEqual: true, withinFee: true, sameReference: true, sameCounterpartyHash: true, counterpartyIsOwnAccount: false, counterpartyIsProfileName: false, answered: null })
    record('O03', 'Own transfer legs captured by two phones, shared ref and name', d.verdict === 'settle', d)
  })
})

describe('AI fallback correction exemplar', () => {
  it('X01 a single user\'s newest correction rides on another row\'s corroboration', () => {
    const rows = [
      // newest: one unknown user, no template, poisoned reading
      { corrected_fields: { kind: 'own_transfer', amount: 1 }, redacted_body: 'Your card #### was used for EGP ## at ####', source_template_id: null, sms_template_signals: { user_id: 'attacker' } },
      // older: legitimately corroborated via a template
      { corrected_fields: { kind: 'purchase' }, redacted_body: 'Your card #### was used for EGP ## at ####', source_template_id: 'tpl-1', sms_template_signals: { user_id: 'u2' } },
    ]
    const out = formatCorrectionExemplar(rows)
    const leaked = !!out && out.includes('own_transfer')
    record('X01', 'Uncorroborated newest correction injected into every user\'s prompt', !leaked, { exemplar: out })
  })
})
