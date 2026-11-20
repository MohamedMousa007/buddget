import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/navigation/navigate', () => ({ navigate: vi.fn() }))
vi.mock('@/lib/apiBase', () => ({ apiFetchAuth: vi.fn() }))
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { resetAutoSlots } from '@/lib/buddgy/tools/autoApplyGuard'
import { applyBatch, BATCH_TOOL, groupBatches, isBatch, removeBatchItem, replaceBatchItem } from '@/lib/buddgy/tools/batch'
import { resetSameTurnMemory } from '@/lib/buddgy/tools/exec/expenses'
import type { Proposal } from '@/lib/buddgy/tools/proposal'
import { refOf } from '@/lib/buddgy/tools/refs'
import { reviseProposalArgs } from '@/lib/buddgy/tools/revise'
import { restoreItems } from '@/lib/buddgy/client/savedChats'
import type { BuddgyItem } from '@/lib/buddgy/client/chatTypes'
import { buddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'

const ctx = { now: new Date('2026-10-19T12:00:00'), locale: 'en' as const }
const CASH = 'aaaaaaaa-0000-0000-0000-000000000001'
const CIB = 'd4d4d4d4-0000-0000-0000-000000000002'
const pm = (id: string, name: string, isDefault: boolean, type = 'cash'): PaymentMethod => ({ id, name, type, currency: 'EGP', isDefault }) as PaymentMethod

const expenses = () => useFinanceStore.getState().expenses

function propose(args: Record<string, unknown>): Proposal {
  const r = TOOLS.get('add_expense')!.write!.propose(args, ctx)
  if (!r.ok) throw new Error(r.error)
  return r.proposal
}

const three = () => [
  propose({ description: 'Coffee', amount: 55, category: 'Food', method: 'Cash' }),
  propose({ description: 'Uber', amount: 120, category: 'Transport' }),
  propose({ description: 'Carrefour', amount: 640, category: 'Groceries', method: 'CIB Card' }),
]

beforeEach(() => {
  resetAutoSlots()
  resetSameTurnMemory()
  useFinanceStore.setState({
    paymentMethods: [pm(CASH, 'Cash', true), pm(CIB, 'CIB Card', false, 'debit_card')],
    expenses: [],
    incomeSources: [],
    incomeEvents: [],
    budgetPlans: [],
    activeBudgetPlanId: null,
    exchangeRates: {},
    settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
  })
})

describe('a quick add proposes a record card', () => {
  it('carries the amount, the description, the method it will use, and keys on its rows', () => {
    const p = propose({ description: 'Coffee', amount: 55, category: 'Food', method: 'CIB Card' })
    expect(p.preview).toMatchObject({ pattern: 'record', amount: 55, currency: 'EGP', what: 'Coffee', methodRef: refOf(CIB) })
    expect(p.preview.missing).toBeUndefined()
    expect(p.preview.rows.map((r) => r.key)).toEqual(['description', 'amount', 'category', 'method', 'date'])
  })

  it('an unnamed method is asked about (best guess kept) and an unnamed category is marked guessed', () => {
    const p = propose({ description: 'Uber', amount: 120 })
    expect(p.preview.missing).toEqual(['method'])
    expect(p.preview.methodRef).toBe(refOf(CASH))
    expect(p.preview.guessed).toEqual(['category'])
  })

  it('with only one method there is nothing to ask', () => {
    useFinanceStore.setState({ paymentMethods: [pm(CASH, 'Cash', true)] })
    expect(propose({ description: 'Uber', amount: 120 }).preview.missing).toBeUndefined()
  })
})

describe('batch grouping', () => {
  it('two or more quick adds become one batch card in the first one\'s place; other cards stay', () => {
    const other = { ...propose({ description: 'x', amount: 1, category: 'Food' }), tool: 'update_goal' }
    const [a, b, c] = three()
    const out = groupBatches([other, a, b, c], 'en')
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(other)
    expect(isBatch(out[1])).toBe(true)
    expect(out[1].tool).toBe(BATCH_TOOL)
    expect(out[1].risk).toBe('approve')
    expect(out[1].preview.items?.map((r) => r.proposal.preview.what)).toEqual(['Coffee', 'Uber', 'Carrefour'])
    expect(out[1].preview).toMatchObject({ pattern: 'batch', amount: 815, currency: 'EGP' })
  })

  it('a single quick add stays a record card, so its own auto-apply rules hold', () => {
    const [a] = three()
    expect(groupBatches([a], 'en')).toEqual([a])
  })

  it('the batch goes out of date with its oldest row', () => {
    const [a, b] = three()
    const batch = groupBatches([{ ...a, createdAt: 1000 }, { ...b, createdAt: 5000 }], 'en')[0]
    expect(batch.createdAt).toBe(1000)
  })

  it('mixed currencies give no single total', () => {
    const [a] = three()
    const usd = { ...a, id: 'usd', preview: { ...a.preview, currency: 'USD' } }
    expect(groupBatches([a, usd], 'en')[0].preview.amount).toBeUndefined()
  })
})

describe('removing a row', () => {
  it('drops the row and updates the total and the button count', () => {
    const batch = groupBatches(three(), 'en')[0]
    const uber = batch.preview.items![1].key
    const left = removeBatchItem(batch, uber, 'en')
    expect(left.id).toBe(batch.id)
    expect(left.preview.items).toHaveLength(2)
    expect(left.preview.amount).toBe(695)
    const cta = (n: number) => buddgyCardCopy.en.primary({ tool: BATCH_TOOL, pattern: 'batch', count: n })
    expect(cta(3)).toBe('Add 3 expenses')
    expect(cta(left.preview.items!.length)).toBe('Add 2 expenses')
    expect(cta(1)).toBe('Add 1 expense')
    expect(cta(0)).toBe('Nothing to add')
    expect(buddgyCardCopy.ar.primary({ tool: BATCH_TOOL, pattern: 'batch', count: 3 })).toContain('3')
  })

  it('removing every row leaves nothing to apply', () => {
    let batch = groupBatches(three(), 'en')[0]
    for (const r of batch.preview.items!) batch = removeBatchItem(batch, r.key, 'en')
    expect(batch.preview.items).toEqual([])
    const r = applyBatch(batch, ctx)
    expect(r.ok).toBe(false)
    expect(expenses()).toHaveLength(0)
  })
})

describe('applying a batch', () => {
  it('writes every remaining row, and one Undo takes them all back', () => {
    const batch = groupBatches(three(), 'en')[0]
    const kept = removeBatchItem(batch, batch.preview.items![0].key, 'en')
    const r = applyBatch(kept, ctx)
    expect(r.ok).toBe(true)
    expect(expenses().map((e) => e.description)).toEqual(['Uber', 'Carrefour'])
    expect(r.ok && r.message).toMatch(/^Added 2 expenses · /)
    if (r.ok) r.undo?.()
    expect(expenses()).toHaveLength(0)
  })

  it('a row that fails takes back the rows already written, so Try again cannot double them', () => {
    const batch = groupBatches(three(), 'en')[0]
    // Carrefour was on CIB Card; the card is gone by the time the person taps.
    useFinanceStore.setState({ paymentMethods: [pm(CASH, 'Cash', true)] })
    const r = applyBatch(batch, ctx)
    expect(r.ok).toBe(false)
    expect(expenses()).toHaveLength(0)
  })

  it('applies the rows as edited, not as first proposed', () => {
    const batch = groupBatches(three(), 'en')[0]
    const row = batch.preview.items![1]
    const revised = reviseProposalArgs(row.proposal, { method: refOf(CIB) }, ctx)
    if (!revised?.ok) throw new Error('revise failed')
    const next = replaceBatchItem(batch, row.key, revised.proposal, 'en')
    applyBatch(next, ctx)
    expect(expenses().find((e) => e.description === 'Uber')?.paymentMethodId).toBe(CIB)
  })
})

describe('a picker revises the proposal', () => {
  it('picking a method answers the question: the ring moves and nothing is missing any more', () => {
    const p = propose({ description: 'Uber', amount: 120, category: 'Transport' })
    expect(p.preview.missing).toEqual(['method'])
    const r = reviseProposalArgs(p, { method: refOf(CIB) }, ctx)
    expect(r?.ok && r.proposal.preview.methodRef).toBe(refOf(CIB))
    expect(r?.ok && r.proposal.preview.missing).toBeUndefined()
  })

  it('picking a category or a date changes that line only', () => {
    const p = propose({ description: 'Uber', amount: 120 })
    const cat = reviseProposalArgs(p, { category: 'Transport' }, ctx)
    expect(cat?.ok && cat.proposal.preview.guessed).toBeUndefined()
    expect(cat?.ok && cat.proposal.args.category).toBe('Transport')
    const day = reviseProposalArgs(p, { date: '2026-10-18' }, ctx)
    expect(day?.ok && day.proposal.args).toMatchObject({ date: '2026-10-18', amount: 120 })
  })

  it('a revised row keeps its key and its place in the batch, and the total follows', () => {
    const batch = groupBatches(three(), 'en')[0]
    const row = batch.preview.items![0]
    const r = reviseProposalArgs(row.proposal, { amount: '60' }, ctx)
    if (!r?.ok) throw new Error('revise failed')
    const next = replaceBatchItem(batch, row.key, r.proposal, 'en')
    expect(next.preview.items![0].key).toBe(row.key)
    expect(next.preview.amount).toBe(820)
  })
})

describe('after states are unchanged', () => {
  it('a batch left waiting when the app closes is out of date, like any other card', () => {
    const batch = groupBatches(three(), 'en')[0]
    const item: BuddgyItem = { id: 'b', role: 'buddgy', text: '', proposals: [{ proposal: batch, status: 'pending' }, { proposal: batch, status: 'applied' }], reads: [], status: 'done' }
    expect((restoreItems([item])[0] as BuddgyItem).proposals.map((p) => p.status)).toEqual(['stale', 'applied'])
  })
})
