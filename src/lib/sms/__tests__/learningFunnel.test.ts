import { describe, expect, it } from 'vitest'
import { normalizeSmsText, stripFormatMarks } from '../normalizeDigits'
import { parseSmsDay } from '../parseSmsDay'
import { applyMappingRules, cleanLast4, last4Agrees, type MappingRules } from '../templateApply'
import { runLearnGates } from '../learnGates'
import { computeSmsHash, computeLegacySmsHashes } from '../ingestGuards'
import { maskPii, scanForLeaks } from '../maskPii'
import { smsSkeleton } from '../skeleton'
import { perUserLiteralKinds } from '../literalLeaks'
import { replayAgainst, replayCandidate, materializeShape, type ReplayCase } from '../replayHarness'
import { classifyLearnStatus, decideLearnRetry, encodeLearnStatus } from '../learnRetry'
import { computeCoverage, topUnlearnedShapes } from '../coverage'
import { senderCapReached } from '../senderCap'
import { shouldQuarantine } from '../quarantineRule'
import { buildStatsRow, rejectedExampleTag } from '../statsOutbox'

const RLM = '‏'
const LRM = '‎'

describe('LF1/N5 normaliser', () => {
  it('strips bidi and format marks but never Arabic letters', () => {
    const raw = `${RLM}تم خصم${LRM} ‪EGP‬ ⁦ 9999⁩﻿‍‌`
    expect(stripFormatMarks(raw)).toBe('تم خصم EGP  9999')
    expect(normalizeSmsText('تم خصم')).toBe('تم خصم')
  })
  it('maps Arabic-Indic digits and separators', () => {
    expect(normalizeSmsText('EGP ١٢٬٣٤٥٫٦٧')).toBe('EGP 12,345.67')
  })
  it('hash is over the raw message; legacy hash covers the old digit-normalised one', () => {
    const arabic = 'EGP ١٢٣٤٫٥٠ at SHOP'
    expect(computeSmsHash(arabic)).not.toBe(computeSmsHash(normalizeSmsText(arabic)))
    expect(computeLegacySmsHashes(arabic)).toEqual([computeSmsHash('EGP 1234.50 at SHOP')])
    expect(computeLegacySmsHashes('EGP 1234.50 at SHOP')).toEqual([])
  })
  it('applier matches a body with bidi marks and Arabic digits', () => {
    const rules: MappingRules = { amount: { group: 1 }, currency: { literal: 'EGP' }, kind: 'purchase' }
    const x = applyMappingRules(`Purchase${RLM} of EGP ${'١٢٣'}.50 at SHOP`, 'Purchase\\s+of\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at', rules)
    expect(x?.amount).toBe(123.5)
  })
  it('still applies a stored regex that embeds a mark literally', () => {
    const rules: MappingRules = { amount: { group: 1 }, kind: 'purchase' }
    const x = applyMappingRules(`Paid${RLM} EGP 50.00 now`, `Paid${RLM} EGP\\s+([\\d.]+)`, rules)
    expect(x?.amount).toBe(50)
  })
})

describe('LF2 dates', () => {
  const ref = new Date('2026-07-24T10:00:00Z')
  it.each([
    ['24/07/26', '2026-07-24'], ['24-07-2026', '2026-07-24'], ['2026-07-24', '2026-07-24'], ['24.07.26', '2026-07-24'],
    ['13JUN26', '2026-06-13'], ['13 Jun 2026', '2026-06-13'], ['Jun 13, 2026', '2026-06-13'], ['13 June 2026', '2026-06-13'],
    ['٢٤/٠٧/٢٦', '2026-07-24'], ['24/07/26 05:30 PM', '2026-07-24'], ['13 يونيو 2026', '2026-06-13'],
  ])('parses %s', (raw, out) => expect(parseSmsDay(raw, ref)).toBe(out))
  it('infers the year of a year-less date from the receive time', () => {
    expect(parseSmsDay('20-07', ref)).toBe('2026-07-20')
    expect(parseSmsDay('20-07 14:30', ref)).toBe('2026-07-20')
    expect(parseSmsDay('13 يونيو', ref)).toBe('2026-06-13')
    expect(parseSmsDay('30/12', new Date('2027-01-02T00:00:00Z'))).toBe('2026-12-30')
  })
  it('rejects impossible dates', () => {
    expect(parseSmsDay('31/02/26', ref)).toBeNull()
    expect(parseSmsDay('13XYZ26', ref)).toBeNull()
    expect(parseSmsDay('hello', ref)).toBeNull()
  })
  it('a year-less datetime no longer fails the learn gate', () => {
    const msg = 'Card 9999 charged EGP 120.50 at SHOP on 20-07 14:30'
    const rules: MappingRules = { amount: { group: 1 }, currency: { literal: 'EGP' }, datetime: { group: 2 }, kind: 'purchase' }
    const rx = 'charged\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at\\s+\\S+\\s+on\\s+(\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})'
    expect(runLearnGates(msg, rx, rules, { amount: 120.5, currency: 'EGP', detectedAccountLast4: null }, { receivedAt: '2026-07-20T12:00:00Z' })).toEqual({ ok: true })
  })
  it('a datetime group with no digits still fails', () => {
    const msg = 'Card 9999 charged EGP 120.50 at SHOP on today'
    const rules: MappingRules = { amount: { group: 1 }, datetime: { group: 2 }, kind: 'purchase' }
    const r = runLearnGates(msg, 'charged\\s+EGP\\s+([\\d,.]+)\\s+at\\s+\\S+\\s+on\\s+(\\w+)', rules, { amount: 120.5, currency: null, detectedAccountLast4: null })
    expect(r.ok).toBe(false)
  })
})

describe('N6 amounts', () => {
  const rules: MappingRules = { amount: { group: 1 }, currency: { literal: 'EGP' }, kind: 'purchase' }
  const rx = 'EGP\\s+([\\d.,\\s]+?)\\s+at'
  it.each([['EGP 1.250,50 at', 1250.5], ['EGP 1 250,50 at', 1250.5], ['EGP 1,250.50 at', 1250.5], ['EGP 1,250 at', 1250]])('%s', (body, v) => {
    expect(applyMappingRules(body, rx, rules)?.amount).toBe(v)
  })
})

describe('N22 last4', () => {
  it('pads 3 digits and agrees across leading zeros', () => {
    expect(cleanLast4('**978')).toBe('0978')
    expect(last4Agrees('978', '0978')).toBe(true)
    expect(last4Agrees('9781', '0978')).toBe(false)
  })
})

describe('N14 per-user literals + LF6 masking', () => {
  it('flags names, long numbers and the sample amount inside a regex', () => {
    expect(perUserLiteralKinds('Transfer\\s+to\\s+NAME ONE\\s+([\\d.]+)')).toContain('name_caps')
    expect(perUserLiteralKinds('from\\s+account\\s+99999999\\s+of\\s+([\\d.]+)')).toContain('long_number')
    expect(perUserLiteralKinds('الى\\s+السيد محمد احمد\\s+([\\d.]+)')).toContain('name_arabic')
    expect(perUserLiteralKinds('amount\\s+120\\.50\\s+at', { amount: 120.5 })).toContain('amount_literal')
    expect(perUserLiteralKinds('card\\s+9999\\s+at', { last4: '9999' })).toContain('last4_literal')
    expect(perUserLiteralKinds('Purchase\\s+of\\s+EGP\\s+([\\d,]+)\\s+at\\s+(.+?)\\s+on')).toEqual([])
  })
  it('the learn gate rejects such a regex', () => {
    const msg = 'Sent EGP 55.25 to NAME ONE card 9999'
    const rules: MappingRules = { amount: { group: 1 }, kind: 'transfer' }
    const r = runLearnGates(msg, 'Sent\\s+EGP\\s+([\\d.]+)\\s+to\\s+NAME ONE', rules, { amount: 55.25, currency: null, detectedAccountLast4: null })
    expect(r).toMatchObject({ ok: false, status: 'gate_per_user_literal' })
  })
  it('masks Title-Case, ALL-CAPS and Arabic names, emails, phones and URL paths', () => {
    const masked = maskPii('Transfer to Firstname Lastname via a@b.com phone 0100000000 see https://bank.example/path/abcdef123 ثم إلى محمد احمد سعيد')
    expect(masked).toContain('<NAME>')
    expect(masked).toContain('<EMAIL>')
    expect(masked).toContain('<PHONE>')
    expect(masked).not.toContain('Firstname')
    expect(masked).not.toContain('محمد')
    expect(masked).not.toContain('abcdef')
    expect(scanForLeaks(masked)).toEqual([])
  })
  it('keeps bank wording and Arabic letters of non-names', () => {
    const t = 'Your Credit Card was charged. تم خصم من بطاقة الخصم'
    expect(maskPii(t)).toBe(t)
  })
  it('the scanner finds leaks and reports kinds only', () => {
    const found = scanForLeaks('Dear Firstname Lastname acct 123456 total 1,250.50 ‏')
    const kinds = found.map((f) => f.kind)
    expect(kinds).toEqual(expect.arrayContaining(['name_title', 'long_number', 'amount', 'format_mark']))
    expect(JSON.stringify(found)).not.toContain('Firstname')
  })
  it('a skeleton is leak-free and equal across bidi/digit variants', () => {
    const a = smsSkeleton('Sent EGP 55.25 to Firstname Lastname card 9999 ref 123456789', 'BANK')!
    const b = smsSkeleton(`Sent${RLM} EGP 55.25 to Firstname Lastname card 9999 ref 123456789`, 'BANK')!
    expect(a.key).toBe(b.key)
    expect(scanForLeaks(a.redacted).filter((f) => f.kind !== 'amount')).toEqual([])
  })
})

describe('LF5 replay harness', () => {
  const rules: MappingRules = { amount: { group: 1 }, currency: { literal: 'EGP' }, kind: 'purchase' }
  const cases: ReplayCase[] = [
    { id: 'purchase', body: 'Purchase of EGP 100.00 at SHOP', expect: { matches: true, amount: 100, currency: 'EGP', kind: 'purchase' } },
    { id: 'otp', body: 'Code 9999 for EGP 100.00 do not share', expect: { matches: false } },
  ]
  it('passes a clean candidate', () => {
    expect(replayCandidate({ regex: 'Purchase\\s+of\\s+EGP\\s+([\\d.]+)', rules }, cases).ok).toBe(true)
  })
  it('flags a candidate that matches a must-not-match shape or changes a value', () => {
    const loose = replayCandidate({ regex: 'EGP\\s+([\\d.]+)', rules }, cases)
    expect(loose.regressions).toEqual([{ id: 'otp', reason: 'false_positive' }])
    const wrong = replayCandidate({ regex: 'at\\s+(SHOP)', rules }, [{ ...cases[0] }])
    expect(wrong.ok).toBe(true)
  })
  it('the learn gate blocks on replay regression', () => {
    const r = runLearnGates('Purchase of EGP 100.00 at SHOP', 'EGP\\s+([\\d.]+)', rules, { amount: 100, currency: 'EGP', detectedAccountLast4: null }, { replay: cases })
    expect(r).toMatchObject({ ok: false, status: 'gate_replay_regression' })
  })
  it('replayAgainst requires should-match shapes to still match', () => {
    expect(replayAgainst(() => null, cases).regressions).toEqual([{ id: 'purchase', reason: 'not_matched' }])
    expect(materializeShape('card ending # amount #####')).toBe('card ending 9 amount 99999')
  })
})

describe('LF4 retry, coverage, N15, N16, LF7', () => {
  it('classifies and decides retries by class', () => {
    expect(classifyLearnStatus('gate_capture_unsound: datetime group has no digits')).toBe('bad_datetime')
    expect(classifyLearnStatus('gemini_error')).toBe('transient')
    expect(classifyLearnStatus('learned')).toBe('terminal')
    expect(classifyLearnStatus(encodeLearnStatus('regex_loose', 2, 'greedy'))).toBe('regex_loose')
    const last = new Date('2026-07-24T00:00:00Z')
    expect(decideLearnRetry('gate_capture_unsound: datetime', last, new Date('2026-07-24T00:00:01Z')).retry).toBe(true)
    expect(decideLearnRetry('gemini_error', last, new Date('2026-07-24T00:10:00Z')).retry).toBe(false)
    expect(decideLearnRetry(encodeLearnStatus('transient', 3, 'x'), last, new Date('2027-01-01T00:00:00Z')).retry).toBe(false)
    expect(decideLearnRetry('cap_reached', last).retry).toBe(false)
  })
  it('aggregates coverage and top unlearned shapes', () => {
    const rows = [
      { sender_key: 'BANK', redacted_body: 'a', parse_method: 'template', seen_count: 6, ok_count: 6 },
      { sender_key: 'BANK', redacted_body: 'b', parse_method: 'ai_new', seen_count: 4, ok_count: 4 },
    ]
    expect(computeCoverage(rows)[0]).toMatchObject({ sender: 'BANK', total: 10, freeShare: 0.6 })
    expect(topUnlearnedShapes(rows)).toEqual([{ sender: 'BANK', shape: 'b', seen: 4 }])
  })
  it('the sender cap ignores retired rows', () => {
    const ten = Array.from({ length: 10 }, () => ({ status: 'active' }))
    expect(senderCapReached(ten)).toBe(true)
    expect(senderCapReached([...ten.slice(0, 8), { status: 'retired' }, { status: 'retired' }])).toBe(false)
  })
  it('quarantine needs several hard signals from two users', () => {
    expect(shouldQuarantine([{ userId: 'a' }])).toBe(false)
    expect(shouldQuarantine([{ userId: 'a' }, { userId: 'a' }])).toBe(false)
    expect(shouldQuarantine([{ userId: 'a' }, { userId: 'b' }])).toBe(true)
  })
  it('tags rejected transactional shapes, never OTP', () => {
    const body = 'Your account was debited EGP 100.00 offer'
    expect(rejectedExampleTag(body, 'marketing')).toBe('rejected_tx_like')
    expect(rejectedExampleTag(body, 'otp')).toBeNull()
    expect(rejectedExampleTag('Win a prize', 'marketing')).toBeNull()
    const base = { userId: 'u', senderKey: 'BANK', templateId: null, currency: null, isTransaction: false, parsedOk: false, kind: null, parseMethod: 'fully_curated', currencyCode: null }
    expect(buildStatsRow({ ...base, message: body, rejectReason: 'marketing' }).kind).toBe('rejected_tx_like')
    const otp = buildStatsRow({ ...base, message: 'OTP 9999 do not share', rejectReason: 'otp' })
    expect(otp.skeleton_key).toBeNull()
    expect(otp.redacted_body).toBeNull()
  })
})
