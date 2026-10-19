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
