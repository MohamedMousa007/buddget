import type { BuddgyLocale } from '@/lib/buddgy/protocol'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import type { ApplyResult, Proposal } from '@/lib/buddgy/tools/proposal'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { money } from '@/lib/buddgy/tools/writeKit'

/**
 * Several quick adds in one reply become one card: one tap adds them all, one Undo takes them all back.
 * The batch is not a tool (the model never sees it); each row keeps its own proposal and is applied by its own tool.
 */
export const BATCH_TOOL = 'batch'

/** Tools whose proposals group into a batch. */
const BATCHABLE: ReadonlySet<string> = new Set(['add_expense'])

const COPY = {
  en: {
    title: 'Add expenses',
    added: (n: number) => `Added ${n} ${n === 1 ? 'expense' : 'expenses'}`,
    nothing: 'Nothing left to add.',
  },
  ar: {
    title: 'إضافة مصروفات',
    added: (n: number) => (n === 1 ? 'تمت إضافة مصروف واحد' : `تمت إضافة ${n} مصروفات`),
    nothing: 'لا يوجد شيء للإضافة.',
  },
} as const

export const isBatch = (p: Proposal): boolean => p.tool === BATCH_TOOL

/** The total when every row is in one currency; mixed currencies have no honest single total. */
export function batchTotal(items: readonly Proposal[]): { amount: number; currency: string } | null {
  const currency = items[0]?.preview.currency
  if (!currency || items.some((p) => p.preview.currency !== currency || typeof p.preview.amount !== 'number')) return null
  return { amount: Math.round(items.reduce((s, p) => s + (p.preview.amount ?? 0), 0) * 100) / 100, currency }
}

/** Builds the batch card for these rows. Keys are the rows' own proposal ids, so a row keeps its key through a revise. */
export function makeBatch(rows: readonly { key: string; proposal: Proposal }[], locale: BuddgyLocale, id: string = crypto.randomUUID()): Proposal {
  const children = rows.map((r) => r.proposal)
  const total = batchTotal(children)
  return {
    id,
    tool: BATCH_TOOL,
    args: {},
    risk: 'approve',
    // The oldest row decides when the card goes out of date.
    createdAt: children.length ? Math.min(...children.map((p) => p.createdAt)) : Date.now(),
    summary: children.map((p) => p.summary).join(' '),
    preview: {
      domain: 'expenses',
      tone: 'add',
      title: COPY[locale].title,
      rows: [],
      pattern: 'batch',
      items: rows.map((r) => ({ key: r.key, proposal: r.proposal })),
      ...(total ? { amount: total.amount, currency: total.currency } : {}),
    },
  }
}

/** Folds two or more batchable proposals into one batch card, placed where the first of them was. */
export function groupBatches(proposals: readonly Proposal[], locale: BuddgyLocale): Proposal[] {
  const rows = proposals.filter((p) => BATCHABLE.has(p.tool))
  if (rows.length < 2) return [...proposals]
  const batch = makeBatch(rows.map((p) => ({ key: p.id, proposal: p })), locale)
  const out: Proposal[] = []
  for (const p of proposals) {
    if (!BATCHABLE.has(p.tool)) out.push(p)
    else if (p === rows[0]) out.push(batch)
  }
  return out
}

const rowsOf = (batch: Proposal) => batch.preview.items ?? []

/** The batch without one row: count, total and the button all follow. */
export function removeBatchItem(batch: Proposal, key: string, locale: BuddgyLocale): Proposal {
  return makeBatch(rowsOf(batch).filter((r) => r.key !== key), locale, batch.id)
}

/** The batch with one row's proposal replaced (a picker or an edit revised it). */
export function replaceBatchItem(batch: Proposal, key: string, next: Proposal, locale: BuddgyLocale): Proposal {
  return makeBatch(rowsOf(batch).map((r) => (r.key === key ? { key, proposal: next } : r)), locale, batch.id)
}

/**
 * Applies every row, in order. The store has no transaction, so a row that fails takes back the rows already
 * written: the card then says it could not apply and nothing is left half-added, and Try again cannot double up.
 */
export function applyBatch(batch: Proposal, ctx: ToolContext): ApplyResult {
  const rows = rowsOf(batch)
  const copy = COPY[ctx.locale]
  if (rows.length === 0) return { ok: false, error: copy.nothing }
  const undos: (() => void)[] = []
  const rollBack = () => {
    for (const u of [...undos].reverse()) u()
  }
  for (const { proposal } of rows) {
    const write = TOOLS.get(proposal.tool)?.write
    const r = write ? write.apply(proposal, { ...ctx, revising: true }) : ({ ok: false, error: 'unknown_tool' } as const)
    if (!r.ok) {
      rollBack()
      return { ok: false, error: r.error }
    }
    if (r.undo) undos.push(r.undo)
  }
  const total = batchTotal(rows.map((r) => r.proposal))
  return {
    ok: true,
    message: [copy.added(rows.length), total ? money(total.amount, total.currency) : ''].filter(Boolean).join(' · '),
    undo: undos.length ? rollBack : undefined,
  }
}
