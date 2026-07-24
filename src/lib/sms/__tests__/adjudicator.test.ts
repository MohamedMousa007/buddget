import { describe, it, expect } from 'vitest'
import {
  parseAdjudication,
  verdictCountsAgainstTemplate,
  buildAdjudicationPrompt,
  redactBody,
  type AdjudicationVerdict,
} from '../adjudicator'

describe('verdictCountsAgainstTemplate — the false-positive firewall', () => {
  it('counts only genuine parser faults', () => {
    expect(verdictCountsAgainstTemplate('parse_error')).toBe(true)
    expect(verdictCountsAgainstTemplate('not_transaction')).toBe(true)
  })

  it('never penalises a template for a user preference, a duplicate, or ambiguity', () => {
    // This is the whole reason adjudication exists: a user recategorising a coffee or deleting
    // a transaction they had already logged must cost the template nothing.
    for (const v of ['user_preference', 'duplicate', 'unclear'] as AdjudicationVerdict[]) {
      expect(verdictCountsAgainstTemplate(v)).toBe(false)
    }
  })
})

describe('parseAdjudication — a malformed response must not retire a working template', () => {
  it('reads a well-formed parse_error with its correction', () => {
    const r = parseAdjudication({
      verdict: 'parse_error',
      confidence: 0.95,
      corrected: { amount: 715, currency: 'EGP', kind: 'purchase', last4: '0001', date: '2026-07-22' },
      reason: 'captured the balance',
    })
    expect(r.verdict).toBe('parse_error')
    expect(r.corrected).toMatchObject({ amount: 715, currency: 'EGP' })
    expect(r.confidence).toBe(0.95)
  })

  it('falls back to unclear on an unknown or missing verdict', () => {
    expect(parseAdjudication({ verdict: 'banana' }).verdict).toBe('unclear')
    expect(parseAdjudication({}).verdict).toBe('unclear')
    expect(parseAdjudication(null).verdict).toBe('unclear')
    // unclear never counts, so a garbled response is inert rather than destructive.
    expect(verdictCountsAgainstTemplate(parseAdjudication(undefined).verdict)).toBe(false)
  })

  it('ignores a correction attached to a non-error verdict', () => {
    // A confused response must not be able to inject an exemplar that biases the shape forever.
    const r = parseAdjudication({
      verdict: 'user_preference',
      corrected: { amount: 999 },
    })
    expect(r.corrected).toBeUndefined()
  })

  it('clamps confidence into range', () => {
    expect(parseAdjudication({ verdict: 'unclear', confidence: 5 }).confidence).toBe(1)
    expect(parseAdjudication({ verdict: 'unclear', confidence: -2 }).confidence).toBe(0)
    expect(parseAdjudication({ verdict: 'unclear', confidence: 'high' }).confidence).toBe(0)
  })

  it('drops non-numeric fields out of a correction rather than trusting them', () => {
    const r = parseAdjudication({
      verdict: 'parse_error',
      corrected: { amount: 'seven hundred', currency: 42 },
    })
    expect(r.corrected).toEqual({ amount: null, currency: null, kind: null, last4: null, date: null })
  })
})

describe('buildAdjudicationPrompt', () => {
  it('describes each change in plain terms', () => {
    const p = buildAdjudicationPrompt({
      body: 'Your credit card#2016 was charged for EGP 605.00 at FUEL UP',
      extracted: { amount: 686.89, currency: 'EGP', kind: 'purchase', last4: '2016', date: '2026-07-24' },
      changes: [
        { signalKind: 'objective_edit', field: 'amount', from: '686.89', to: '605.00' },
        { signalKind: 'delete' },
      ],
    })
    expect(p).toContain('changed amount')
    expect(p).toContain('DELETED')
    expect(p).toContain('686.89')
  })
})

describe('redactBody — exemplars are read into prompts and shown in admin', () => {
  it('masks account numbers and long digit runs', () => {
    const out = redactBody('Your HSBC Account ********0001 debited ref 15ad88c8 on 103-104***-110')
    expect(out).not.toContain('0001')
    expect(out).toContain('****')
  })

  it('masks person names', () => {
    // Real bodies in this corpus carry full names of the user and their counterparties.
    const out = redactBody('IPN outward transfer to SALMA SAMY ELSAYED with reference')
    expect(out).not.toContain('SALMA')
    expect(out).toContain('<NAME>')
  })

  it('keeps the message shape recognisable so the exemplar is still useful', () => {
    const out = redactBody('From HSBC: 22JUL26 ELWAHAT Purchase from 103-104***-001 EGP 715.00-')
    expect(out).toContain('Purchase')
    expect(out).toContain('EGP')
  })
})
