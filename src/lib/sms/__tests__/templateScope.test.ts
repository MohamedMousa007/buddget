import { describe, it, expect } from 'vitest'
import {
  partitionByScope,
  objectiveFieldsAgree,
  validateAgainstAiParse,
  behaviourallyEquivalent,
  type TemplateCandidate,
} from '../templateScope'
import type { MappingRules } from '../templateApply'

const CIB_BODY =
  'Your credit card#2016 was charged for EGP 386.40 at BEANOS MAADI 1 on 20/07/26  at 23:08.You are over the limit by  309.02.For details visit https://cib.eg/mb'

const CIB_RX =
  'Your\\s+credit\\s+card\\#(\\d+)\\s+was\\s+charged\\s+for\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at\\s+(.+?)\\s+on'
const CIB_RULES: MappingRules = {
  amount: { group: 2, removeCommas: true },
  last4: { group: 1 },
  merchant: { group: 3 },
  currency: { literal: 'EGP' },
  kind: 'purchase',
}

const tpl = (over: Partial<TemplateCandidate> & { id: string }): TemplateCandidate => ({
  regex_pattern: CIB_RX,
  mapping_rules: CIB_RULES as unknown as Record<string, unknown>,
  match_count: 0,
  tier: 'template',
  status: 'active',
  template_sample: CIB_BODY,
  ...over,
})

describe('partitionByScope — reach', () => {
  it('lets everyone parse with a Curated DB template', () => {
    const { usable, validationOnly } = partitionByScope([tpl({ id: 'a', tier: 'curated_db' })], new Set())
    expect(usable.map((t) => t.id)).toEqual(['a'])
    expect(validationOnly).toEqual([])
  })

  it('lets only contributors parse with a supervised Template', () => {
    const cands = [tpl({ id: 'mine' }), tpl({ id: 'theirs' })]
    const { usable, validationOnly } = partitionByScope(cands, new Set(['mine']))
    expect(usable.map((t) => t.id)).toEqual(['mine'])
    // The one this user cannot use is exactly the one needing independent validation.
    expect(validationOnly.map((t) => t.id)).toEqual(['theirs'])
  })

  it('orders trusted before supervised, then by proven volume', () => {
    const cands = [
      tpl({ id: 'supervised-busy', tier: 'template', match_count: 99 }),
      tpl({ id: 'trusted-quiet', tier: 'curated_db', match_count: 1 }),
      tpl({ id: 'trusted-busy', tier: 'curated_db', match_count: 50 }),
    ]
    const { usable } = partitionByScope(cands, new Set(['supervised-busy']))
    // Alphabetically 'curated_db' < 'template' only by luck — this asserts the explicit order.
    expect(usable.map((t) => t.id)).toEqual(['trusted-busy', 'trusted-quiet', 'supervised-busy'])
  })
})

describe('objectiveFieldsAgree', () => {
  const base = { amount: 386.4, currency: 'EGP', kind: 'purchase', last4: '2016' }

  it('agrees with itself', () => {
    expect(objectiveFieldsAgree(base, { ...base })).toBe(true)
  })

  it('ignores a field only one side claims', () => {
    expect(objectiveFieldsAgree(base, { ...base, last4: null })).toBe(true)
    expect(objectiveFieldsAgree({ ...base, kind: null }, base)).toBe(true)
  })

  it('rejects a different amount, currency, kind or last4', () => {
    expect(objectiveFieldsAgree(base, { ...base, amount: 999 })).toBe(false)
    expect(objectiveFieldsAgree(base, { ...base, currency: 'SAR' })).toBe(false)
    expect(objectiveFieldsAgree(base, { ...base, kind: 'income' })).toBe(false)
    expect(objectiveFieldsAgree(base, { ...base, last4: '9999' })).toBe(false)
  })

  it('is case-insensitive on currency and tolerant of cent rounding', () => {
    expect(objectiveFieldsAgree(base, { ...base, currency: 'egp' })).toBe(true)
    expect(objectiveFieldsAgree(base, { ...base, amount: 386.401 })).toBe(true)
  })
})

describe('validateAgainstAiParse — how a supervised template earns promotion', () => {
  const aiFields = { amount: 386.4, currency: 'EGP', kind: 'purchase', last4: '2016' }

  it('counts agreement on an independent user SMS as evidence', () => {
    const out = validateAgainstAiParse(CIB_BODY, aiFields, [tpl({ id: 'theirs' })])
    expect(out).toEqual([{ templateId: 'theirs', result: 'agreed' }])
  })

  it('counts disagreement as a defect signal', () => {
    const out = validateAgainstAiParse(CIB_BODY, { ...aiFields, amount: 999 }, [tpl({ id: 'theirs' })])
    expect(out[0]).toMatchObject({ templateId: 'theirs', result: 'disagreed' })
  })

  it('stays silent when the template does not match — absence is not evidence', () => {
    const other = tpl({ id: 'unrelated', regex_pattern: 'NOTHING\\s+HERE\\s+(\\d+)' })
    expect(validateAgainstAiParse(CIB_BODY, aiFields, [other])).toEqual([])
  })
})

describe('behaviourallyEquivalent — merge cosmetic variants, not distinct templates', () => {
  const a = { regex: CIB_RX, rules: CIB_RULES, sample: CIB_BODY }

  it('treats a differently-spelled regex with identical behaviour as the same template', () => {
    // Same extraction, different wildcard style — the exact variance the AI produces.
    const b = {
      regex: 'credit\\s+card\\#(\\d+)\\s+was\\s+charged\\s+for\\s+EGP\\s+([\\d,]+\\.?\\d*)\\s+at\\s+([A-Z0-9 ]+?)\\s+on',
      rules: CIB_RULES,
      sample: CIB_BODY,
    }
    expect(behaviourallyEquivalent(a, b)).toBe(true)
  })

  it('keeps two regexes apart when they extract different amounts', () => {
    const wrong = {
      regex: 'over\\s+the\\s+limit\\s+by\\s+\\s*([\\d,]+\\.?\\d*)',
      rules: { amount: { group: 1, removeCommas: true }, kind: 'purchase' } as MappingRules,
      sample: CIB_BODY,
    }
    expect(behaviourallyEquivalent(a, wrong)).toBe(false)
  })

  it('never merges on zero evidence', () => {
    // Each matches only its own sample, so there is no shared text to compare on.
    const unrelated = {
      regex: 'Money\\s+Added\\s+amount:\\s+([\\d,]+\\.?\\d*)',
      rules: { amount: { group: 1, removeCommas: true }, kind: 'income' } as MappingRules,
      sample: 'Money Added amount: 64.14',
    }
    expect(behaviourallyEquivalent(a, unrelated)).toBe(false)
  })
})
