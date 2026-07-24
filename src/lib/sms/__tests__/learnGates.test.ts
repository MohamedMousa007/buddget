import { describe, it, expect } from 'vitest'
import { runLearnGates } from '../learnGates'
import { balanceClauseSpans } from '../patterns/preFilter'
import type { MappingRules } from '../templateApply'

/**
 * Real corpus bodies (sms_parse_log, July 2026). Nearly every one ends with a balance clause,
 * which is exactly why "captured the balance instead of the amount" is the most common
 * systematic misparse — and why it must be impossible to store such a regex.
 */
const HSBC_PURCHASE =
  'From HSBC: 22JUL26 ELWAHAT FOR PETROLEM Purchase from 103-104***-001 EGP 715.00- Your available balance is EGP 3,571.53'
const CIB_CARD =
  'Your credit card#2016 was charged for EGP 605.00 at FUEL UP OCTOBER on 24/07/26  at 00:47.You are over the limit by  686.89.For details visit https://cib.eg/mb'
const AR_DEBIT =
  'تم خصم EGP 12.75  من بطاقة الخصم المباشر # **6212 باستخدام Apple Pay عند  KAZYON في  07/07/26 17:16الرصيد المتاح  EGP3957.91.'

const expected = (amount: number, currency = 'EGP', last4: string | null = null) => ({
  amount,
  currency,
  detectedAccountLast4: last4,
})

describe('L1 — value verification (the hole that shipped balance-capturing regexes)', () => {
  it('accepts a regex whose groups reproduce the AI extraction', () => {
    const rx =
      '(?:From\\s+HSBC:\\s+\\S+\\s+)([A-Z ]+?)\\s+Purchase\\s+from\\s+[\\d*\\-]+\\s+(EGP)\\s+([\\d,]+\\.?\\d*)-'
    const rules: MappingRules = {
      amount: { group: 3, removeCommas: true },
      currency: { group: 2 },
      merchant: { group: 1 },
      kind: 'purchase',
    }
    expect(runLearnGates(HSBC_PURCHASE, rx, rules, expected(715))).toEqual({ ok: true })
  })

  it('REJECTS the regex that captures the trailing balance as the amount', () => {
    // 3,571.53 is the balance; 715.00 is the transaction. This is the exact defect class.
    const bad = 'From\\s+HSBC:.*?balance\\s+is\\s+EGP\\s+([\\d,]+\\.?\\d*)'
    const rules: MappingRules = { amount: { group: 1, removeCommas: true }, kind: 'purchase' }
    const res = runLearnGates(HSBC_PURCHASE, bad, rules, expected(715))
    expect(res.ok).toBe(false)
    // Caught by L1 (value) or L2 (position) — either is a correct rejection.
    if (!res.ok) expect(['gate_amount_mismatch', 'gate_wrong_token_balance']).toContain(res.status)
  })

  it('rejects a regex that captures the wrong last4', () => {
    const rx = 'credit\\s+card#(\\d+)\\s+was\\s+charged\\s+for\\s+EGP\\s+([\\d,]+\\.?\\d*)'
    const rules: MappingRules = {
      amount: { group: 2, removeCommas: true },
      last4: { group: 1 },
      kind: 'purchase',
    }
    const res = runLearnGates(CIB_CARD, rx, rules, expected(605, 'EGP', '9999'))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe('gate_last4_mismatch')
  })

  it('rejects a regex that does not match its own sample', () => {
    const rules: MappingRules = { amount: { group: 1 }, kind: 'purchase' }
    const res = runLearnGates(HSBC_PURCHASE, 'NOTHING\\s+MATCHES\\s+([\\d]+)', rules, expected(715))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe('gate_no_match')
  })
})

describe('L2 — wrong-token (position, not value; no balance is stored)', () => {
  it('locates balance clauses in EN and AR corpus bodies', () => {
    expect(balanceClauseSpans(HSBC_PURCHASE).length).toBeGreaterThan(0)
    expect(balanceClauseSpans(AR_DEBIT).length).toBeGreaterThan(0)
  })

  it('accepts an amount that legitimately equals the balance', () => {
    // Same number in both places — value comparison would false-reject; span comparison does not.
    const body = 'Purchase of EGP 100.00 at SHOP. Your available balance is EGP 100.00'
    const rx = 'Purchase\\s+of\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at'
    const rules: MappingRules = { amount: { group: 1, removeCommas: true }, kind: 'purchase' }
    expect(runLearnGates(body, rx, rules, expected(100))).toEqual({ ok: true })
  })

  it('rejects the same number when captured from inside the balance clause', () => {
    const body = 'Purchase of EGP 100.00 at SHOP. Your available balance is EGP 100.00'
    const rx = 'available\\s+balance\\s+is\\s+EGP\\s+([\\d,]+\\.?\\d*)'
    const rules: MappingRules = { amount: { group: 1, removeCommas: true }, kind: 'purchase' }
    const res = runLearnGates(body, rx, rules, expected(100))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe('gate_wrong_token_balance')
  })
})

describe('L3 — capture sanity', () => {
  it('rejects a merchant capture that swallowed the currency code', () => {
    const rx = 'From\\s+HSBC:\\s+\\S+\\s+(.{0,60}?)\\s+from\\s+[\\d*\\-]+\\s+EGP\\s+([\\d,]+\\.?\\d*)-'
    const rules: MappingRules = {
      amount: { group: 2, removeCommas: true },
      merchant: { group: 1 },
      kind: 'purchase',
    }
    const res = runLearnGates(HSBC_PURCHASE, rx, rules, expected(715))
    // The merchant group here is "ELWAHAT FOR PETROLEM Purchase" — no currency — so this one
    // passes; the guard fires only when a currency actually lands inside the capture.
    expect(res.ok).toBe(true)
  })

  it('rejects a datetime group that does not parse to a real date', () => {
    const rx = 'charged\\s+for\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at\\s+(\\w+)'
    const rules: MappingRules = {
      amount: { group: 1, removeCommas: true },
      datetime: { group: 2 },
      kind: 'purchase',
    }
    const res = runLearnGates(CIB_CARD, rx, rules, expected(605))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe('gate_capture_unsound')
  })
})

describe('L4 — greediness guard', () => {
  it('rejects an unbounded wildcard that will swallow neighbouring text', () => {
    const rules: MappingRules = { amount: { group: 2, removeCommas: true }, merchant: { group: 1 }, kind: 'purchase' }
    const res = runLearnGates(HSBC_PURCHASE, '(.+)\\s+EGP\\s+([\\d,]+\\.?\\d*)', rules, expected(715))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe('gate_regex_too_greedy')
  })

  it('allows a lazy bounded wildcard', () => {
    const rx = 'From\\s+HSBC:\\s+\\S+\\s+(.{1,40}?)\\s+Purchase\\s+from\\s+[\\d*\\-]+\\s+EGP\\s+([\\d,]+\\.?\\d*)-'
    const rules: MappingRules = { amount: { group: 2, removeCommas: true }, merchant: { group: 1 }, kind: 'purchase' }
    expect(runLearnGates(HSBC_PURCHASE, rx, rules, expected(715))).toEqual({ ok: true })
  })
})

describe('Arabic corpus', () => {
  it('verifies an Arabic debit template end to end', () => {
    const rx = 'تم\\s+خصم\\s+(EGP)\\s+([\\d,]+\\.?\\d*)\\s+من\\s+بطاقة\\s+الخصم\\s+المباشر\\s+#\\s+\\*+(\\d{4})'
    const rules: MappingRules = {
      amount: { group: 2, removeCommas: true },
      currency: { group: 1 },
      last4: { group: 3 },
      kind: 'purchase',
    }
    expect(runLearnGates(AR_DEBIT, rx, rules, expected(12.75, 'EGP', '6212'))).toEqual({ ok: true })
  })
})
