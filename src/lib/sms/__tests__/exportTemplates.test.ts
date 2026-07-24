import { describe, it, expect } from 'vitest'
import { exportAsBankPatternSet, redactSample, type ExportableTemplate } from '../exportTemplates'

/** A real live template (CIB card charge) with its real sample. */
const CIB: ExportableTemplate = {
  id: '423be87f-4bcc-4d40-9f96-3d83244a89ef',
  sender: 'CIB',
  regex_pattern:
    'Your\\s+credit\\s+card\\#(\\d+)\\s+was\\s+charged\\s+for\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at\\s+(.+?)\\s+on',
  template_sample:
    'Your credit card#2016 was charged for EGP 386.40 at BEANOS MAADI 1 on 20/07/26 at 23:08',
  mapping_rules: {
    kind: 'purchase',
    last4: { group: 1 },
    amount: { group: 2, removeCommas: true },
    currency: { literal: 'EGP' },
    merchant: { group: 3 },
    bank_name: { literal: 'CIB' },
  },
  kind: 'purchase',
  match_count: 12,
  unique_user_count: 3,
}

describe('redactSample — a committed sample is public and permanent', () => {
  it('masks person names', () => {
    const out = redactSample('IPN outward transfer to SALMA SAMY ELSAYED with reference 35692982')
    expect(out).not.toContain('SALMA')
    expect(out).toContain('NAME REDACTED')
  })

  it('masks masked and long account numbers', () => {
    const out = redactSample('Your HSBC Account ********0001 debited, ref 103-104***-110')
    expect(out).not.toContain('0001')
    expect(out).not.toContain('103-104')
  })

  it('collapses newlines so the sample fits one comment line', () => {
    expect(redactSample('Money Added\namount: 64.14 SAR\nvia: Apple pay')).not.toContain('\n')
  })

  it('keeps the wording that makes the sample worth reviewing', () => {
    const out = redactSample(CIB.template_sample!)
    expect(out).toContain('credit card')
    expect(out).toContain('charged')
    expect(out).toContain('EGP')
  })
})

describe('exportAsBankPatternSet', () => {
  const out = exportAsBankPatternSet([CIB], 'CIB')

  it('emits verified: true — without it tryPattern skips the pattern entirely', () => {
    expect(out).toContain('verified: true')
  })

  it('maps the DB vocabulary onto the code pattern vocabulary', () => {
    // `merchant` in a template is `counterparty` in a code pattern — the easy one to get wrong.
    expect(out).toContain('counterparty: 3')
    expect(out).toContain('amount: 2')
    expect(out).toContain('last4: 1')
    expect(out).toContain("currencyLiteral: 'EGP'")
  })

  it('produces a module shaped like the hand-written pattern files', () => {
    expect(out).toContain("import type { BankPatternSet } from './types'")
    expect(out).toContain('export const CIB_PATTERNS: BankPatternSet = {')
    expect(out).toContain("bank: 'CIB'")
    expect(out).toContain("senderIds: ['CIB']")
    expect(out).toContain("kind: 'purchase'")
  })

  it('redacts the sample it embeds as a comment', () => {
    const withName = exportAsBankPatternSet(
      [{ ...CIB, template_sample: 'transfer to SALMA SAMY ELSAYED for EGP 1.50' }],
      'CIB',
    )
    expect(withName).not.toContain('SALMA')
  })

  it('never emits an internal routing key as a senderId', () => {
    // HOTLINE-/BODY- keys are grouping keys, not real sender IDs; the code matcher compares
    // senderIds against the transport sender and would never see them.
    const hotline = exportAsBankPatternSet([{ ...CIB, sender: 'HOTLINE-19666' }], 'CIB')
    expect(hotline).toContain('senderIds: []')
    expect(hotline).not.toContain('HOTLINE-19666')
    const body = exportAsBankPatternSet([{ ...CIB, sender: 'BODY-453e1f57' }], 'Barq')
    expect(body).toContain('senderIds: []')
  })

  it('carries the evidence a reviewer needs to judge the promotion', () => {
    expect(out).toContain('12 matches')
    expect(out).toContain('3 distinct users')
  })

  it('handles a template with no sample', () => {
    expect(() =>
      exportAsBankPatternSet([{ ...CIB, template_sample: null }], 'CIB'),
    ).not.toThrow()
  })

  it('emits a syntactically valid regex literal', () => {
    const m = /regex: \/(.+)\/i,/.exec(out)
    expect(m).not.toBeNull()
    expect(() => new RegExp(m![1], 'i')).not.toThrow()
    // And it must still match the sample it came from.
    expect(new RegExp(m![1], 'i').test(CIB.template_sample!)).toBe(true)
  })

  it('escapes a bare slash, which would otherwise close the literal early', () => {
    // Real patterns contain "for lost/stolen card call" and "https://cib.eg/mb". An unescaped
    // slash there ends the regex mid-pattern and the emitted file does not compile.
    const slashy = exportAsBankPatternSet(
      [{ ...CIB, regex_pattern: 'call\\s+for\\s+lost/stolen\\s+at\\s+https://cib\\.eg/mb\\s+(\\d+)' }],
      'CIB',
    )
    const line = /regex: \/(.*)\/i,/.exec(slashy)![1]
    // Every slash in the emitted literal must be backslash-escaped.
    expect(line).not.toMatch(/(^|[^\\])\//)
    expect(() => new RegExp(line.replace(/\\\//g, '/'), 'i')).not.toThrow()
  })
})
