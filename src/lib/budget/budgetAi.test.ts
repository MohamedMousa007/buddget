import { describe, it, expect } from 'vitest'
import { applyRefinement, lineKey, parseAdjust } from '@/lib/budget/budgetAi'
import type { DraftLine, PlanDraft } from '@/lib/budget/facts'

const line = (p: Partial<DraftLine> & Pick<DraftLine, 'name' | 'amount'>): DraftLine => ({
  block: 'everyday', icon: 'x', linkType: 'none', linkIds: [], dueDay: null, essential: false,
  isSavings: false, expenseCategories: [], rationale: 'engine', confidence: 'high', ...p,
})
const draft: PlanDraft = {
  name: 'Plan', intent: 'balanced', income: 1000, reasons: ['a', 'b', 'c'], risks: [], free: 0,
  lines: [line({ name: 'Dining', amount: 400 }), line({ name: 'Card', amount: 600, block: 'debts', linkType: 'debts', linkIds: ['d1'] })],
}

describe('applyRefinement', () => {
  it('takes rationale, nudges within the band, never moves linked lines', () => {
    const out = applyRefinement(draft, {
      reasons: ['r1', 'r2', 'r3'], risks: ['tight'],
      lines: [
        { key: lineKey(draft.lines[0]), amount: 450, rationale: 'You eat out often', confidence: 'estimated' },
        { key: lineKey(draft.lines[1]), amount: 100, rationale: 'Pay it down', confidence: 'high' },
      ],
    })!
    expect(out.lines[0]).toMatchObject({ amount: 450, rationale: 'You eat out often', confidence: 'estimated' })
    expect(out.lines[1].amount).toBe(600)
    expect(out.reasons).toEqual(['r1', 'r2', 'r3'])
    expect(out.free).toBe(-50)
  })

  it('ignores out-of-band amounts and unknown keys; null when nothing matches', () => {
    const wild = applyRefinement(draft, { lines: [{ key: lineKey(draft.lines[0]), amount: 4000, rationale: 'x', confidence: 'high' }] })!
    expect(wild.lines[0].amount).toBe(400)
    expect(applyRefinement(draft, { lines: [{ key: 'nope', amount: 1, rationale: 'x', confidence: 'high' }] })).toBeNull()
    expect(applyRefinement(draft, 'garbage')).toBeNull()
  })
})

describe('parseAdjust', () => {
  it('types valid ops and drops malformed ones', () => {
    const r = parseAdjust({
      reply: 'Done',
      ops: [{ op: 'set', id: 'a', amount: 10 }, { op: 'set', id: 'a' }, { op: 'move', id: 'a', block: 'nope' }, { op: 'add', block: 'grow', name: 'Gold', amount: 50 }],
      memoryProposals: ['has no car', ''],
    })!
    expect(r.ops).toEqual([{ op: 'set', id: 'a', amount: 10 }, { op: 'add', line: { block: 'grow', name: 'Gold', icon: 'layers', amount: 50 } }])
    expect(r.memoryProposals).toEqual(['has no car'])
    expect(parseAdjust({ ops: [] })).toBeNull()
  })
})

import { validateAdjustInput, validateBuildInput } from '@/lib/budget/budgetAi'

describe('input validation', () => {
  const goodDraft = { intent: 'balanced', income: 1000, lines: [{ name: 'Dining', block: 'everyday', amount: 100, linkType: 'none' }] }
  const goodFacts = { baseCurrency: 'AED', debts: [], goals: [] }

  it('accepts a real build request and strips delimiter characters', () => {
    const r = validateBuildInput({ facts: { ...goodFacts, country: 'U"A<E' }, draft: goodDraft })
    expect(r?.draft.lines[0].name).toBe('Dining')
    expect(r?.facts.country).toBe('UAE')
  })

  it('rejects malformed build and adjust requests instead of throwing', () => {
    expect(validateBuildInput({ facts: goodFacts, draft: { ...goodDraft, intent: 'x"><evil' } })).toBeNull()
    expect(validateBuildInput({ facts: goodFacts, draft: { ...goodDraft, lines: [{ name: 5, block: 'everyday', amount: 1, linkType: 'none' }] } })).toBeNull()
    expect(validateBuildInput({ facts: {}, draft: goodDraft })).toBeNull()
    expect(validateAdjustInput({ text: 'x', currency: 'AED', income: 1, lines: [{ id: 'a', name: 'n', block: 'nope', amount: 1 }] })).toBeNull()
    expect(validateAdjustInput({ text: 'cut dining', currency: 'AED"', income: 5, lines: [{ id: 'a', name: 'Dining', block: 'everyday', amount: 1 }] })).toBeNull()
  })

  it('the model can lock a line but never unlock one', () => {
    const r = parseAdjust({ reply: 'ok', ops: [{ op: 'lock', id: 'r', locked: false }, { op: 'lock', id: 'r', locked: true }], memoryProposals: [] })!
    expect(r.ops).toEqual([{ op: 'lock', id: 'r', locked: true }])
  })
})
