import { describe, expect, it } from 'vitest'
import { applyMappingRules, type MappingRules } from '../templateApply'
import { runLearnGates } from '../learnGates'
import { isSmsExpenseKind, SMS_EXPENSE_KINDS } from '../smsKinds'
import { curatedTemplateInScope } from '../templateScope'
import { lookupKeys } from '../routingKey'

const MSG = 'Purchase of EGP 120.50 at Sample Shop on card 4455'
const REGEX = 'Purchase\\s+of\\s+EGP\\s+([\\d,.]+)\\s+at\\s+(.+?)\\s+on\\s+card\\s+(\\d{4})'
const rules = (kind: string): MappingRules => ({ amount: { group: 1 }, merchant: { group: 2 }, last4: { group: 3 }, currency: { literal: 'EGP' }, kind })

describe('kind validation (S2c step 8c)', () => {
  it('knows the kinds, and nothing else', () => {
    expect(SMS_EXPENSE_KINDS).toContain('income')
    expect(isSmsExpenseKind('purchase')).toBe(true)
    expect(isSmsExpenseKind('transfer')).toBe(false)
    expect(isSmsExpenseKind(undefined)).toBe(false)
    expect(isSmsExpenseKind(null)).toBe(false)
  })
  it('a template with an unknown kind fails the learn gate', () => {
    const r = runLearnGates(MSG, REGEX, rules('transfer'), { amount: 120.5, currency: 'EGP', detectedAccountLast4: '4455' })
    expect(r).toMatchObject({ ok: false, status: 'gate_unknown_kind' })
    expect(runLearnGates(MSG, REGEX, rules('purchase'), { amount: 120.5, currency: 'EGP', detectedAccountLast4: '4455' })).toEqual({ ok: true })
  })
  it('at apply time an unknown or missing kind is no match', () => {
    expect(applyMappingRules(MSG, REGEX, rules('purchase'))).not.toBeNull()
    expect(applyMappingRules(MSG, REGEX, rules('transfer'))).toBeNull()
    expect(applyMappingRules(MSG, REGEX, { amount: { group: 1 } } as unknown as MappingRules)).toBeNull()
  })
})

describe('curated template sender scope (S2c step 8d)', () => {
  it('is tried only when its key is one of the message keys', () => {
    const keys = lookupKeys('CIB', 'Purchase of EGP 120.50 at Sample Shop on card 4455 call 19666')
    expect(keys).toContain('CIB')
    expect(curatedTemplateInScope('CIB', keys)).toBe(true)
    expect(curatedTemplateInScope('HOTLINE-19666', keys)).toBe(true)
    expect(curatedTemplateInScope('QNB', keys)).toBe(false)
    expect(curatedTemplateInScope(null, keys)).toBe(false)
  })
  it('a message with no key at all keeps the broad behaviour', () => {
    expect(lookupKeys('', 'ok')).toEqual([])
    expect(curatedTemplateInScope('QNB', [])).toBe(true)
    expect(curatedTemplateInScope(null, [])).toBe(true)
  })
  it('a sender-less message is scoped by its hotline or body shape, not broad', () => {
    const keys = lookupKeys('', 'Your card was charged for amount at merchant, call 19666')
    expect(keys.some((k) => k.startsWith('HOTLINE-'))).toBe(true)
    expect(curatedTemplateInScope('SNB', keys)).toBe(false)
  })
})
