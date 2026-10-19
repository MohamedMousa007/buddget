import type { BudgetBlock, BudgetPlanCategory } from '@/lib/store/types'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { DraftLine } from '@/lib/budget/facts'

/** What an adjust-by-text request may do to a plan. Every op addresses a line the plan already has by id. */
export type PlanOp =
  | { op: 'set'; id: string; amount: number }
  | { op: 'add'; line: NewLine }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; block: BudgetBlock }
  | { op: 'rename'; id: string; name: string }
  | { op: 'lock'; id: string; locked: boolean }

export type NewLine = Pick<DraftLine, 'block' | 'name' | 'icon' | 'amount'> &
  Partial<Pick<DraftLine, 'dueDay' | 'essential' | 'isSavings' | 'expenseCategories' | 'rationale' | 'confidence'>>

export type RejectReason = 'unknown' | 'locked' | 'linked' | 'invalid' | 'duplicate'

export interface LineDiff {
  id: string
  name: string
  kind: 'changed' | 'added' | 'removed' | 'moved' | 'renamed'
  before: number | null
  after: number | null
  delta: number
}

export interface OpsResult {
  lines: BudgetPlanCategory[]
  applied: PlanOp[]
  rejected: { op: PlanOp; reason: RejectReason }[]
  diff: LineDiff[]
}

export interface OpsOptions {
  newId: () => string
  /** No single line may exceed this (guards a model that mis-scales a number). */
  maxAmount: number
}

const validAmount = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const isLinked = (c: BudgetPlanCategory) => (c.linkType ?? 'none') !== 'none'

function check(lines: BudgetPlanCategory[], op: PlanOp, opts: OpsOptions): RejectReason | null {
  if (op.op === 'add') {
    const { name, amount, block } = op.line
    if (!name.trim() || !validAmount(amount, opts.maxAmount) || !BUDGET_BLOCKS.includes(block)) return 'invalid'
    return lines.some((c) => sameName(c.name, name)) ? 'duplicate' : null
  }
  const line = lines.find((c) => c.id === op.id)
  if (!line) return 'unknown'
  if (op.op === 'lock') return null
  if (line.locked) return 'locked'
  switch (op.op) {
    case 'set':
      if (isLinked(line)) return 'linked'
      if (line.subcategories.length) return 'invalid'
      return validAmount(op.amount, opts.maxAmount) ? null : 'invalid'
    case 'remove':
    case 'move':
      if (isLinked(line)) return 'linked'
      return op.op === 'move' && !BUDGET_BLOCKS.includes(op.block) ? 'invalid' : null
    case 'rename':
      if (!op.name.trim()) return 'invalid'
      return lines.some((c) => c.id !== line.id && sameName(c.name, op.name)) ? 'duplicate' : null
  }
}

function apply(lines: BudgetPlanCategory[], op: PlanOp, opts: OpsOptions): BudgetPlanCategory[] {
  switch (op.op) {
    case 'set':
      return lines.map((c) => (c.id === op.id ? { ...c, amount: op.amount } : c))
    case 'add': {
      const { line } = op
      const added: BudgetPlanCategory = {
        id: opts.newId(),
        name: line.name.trim(),
        icon: line.icon,
        amount: line.amount,
        subcategories: [],
        block: line.block,
        linkType: 'none',
        linkIds: [],
        dueDay: line.dueDay ?? null,
        essential: line.essential ?? false,
        locked: false,
        rationale: line.rationale ?? null,
        confidence: line.confidence ?? null,
        expenseCategories: line.expenseCategories ?? [],
        isSavings: line.isSavings ?? (line.block === 'safety' || line.block === 'goals'),
      }
      return [...lines, added]
    }
    case 'remove':
      return lines.filter((c) => c.id !== op.id)
    case 'move':
      return lines.map((c) => (c.id === op.id ? { ...c, block: op.block } : c))
    case 'rename':
      return lines.map((c) => (c.id === op.id ? { ...c, name: op.name.trim() } : c))
    case 'lock':
      return lines.map((c) => (c.id === op.id ? { ...c, locked: op.locked } : c))
  }
}

/** Amount plus the sum of any subcategories, the way the rest of the app reads a line. */
const amountOf = (c: BudgetPlanCategory) => (c.subcategories.length ? c.subcategories.reduce((s, x) => s + x.amount, 0) : c.amount)

export function diffLines(before: readonly BudgetPlanCategory[], after: readonly BudgetPlanCategory[]): LineDiff[] {
  const prev = new Map(before.map((c) => [c.id, c]))
  const next = new Map(after.map((c) => [c.id, c]))
  const out: LineDiff[] = []
  for (const c of after) {
    const p = prev.get(c.id)
    if (!p) out.push({ id: c.id, name: c.name, kind: 'added', before: null, after: amountOf(c), delta: amountOf(c) })
    else if (amountOf(p) !== amountOf(c))
      out.push({ id: c.id, name: c.name, kind: 'changed', before: amountOf(p), after: amountOf(c), delta: amountOf(c) - amountOf(p) })
    else if (p.block !== c.block)
      out.push({ id: c.id, name: c.name, kind: 'moved', before: amountOf(p), after: amountOf(c), delta: 0 })
    else if (p.name !== c.name)
      out.push({ id: c.id, name: c.name, kind: 'renamed', before: amountOf(p), after: amountOf(c), delta: 0 })
  }
  for (const p of before) {
    if (!next.has(p.id)) out.push({ id: p.id, name: p.name, kind: 'removed', before: amountOf(p), after: null, delta: -amountOf(p) })
  }
  return out
}

/**
 * Applies ops in order, each seeing the result of the previous. A rejected op is skipped and reported;
 * locked and linked lines are never touched. The caller keeps `before` for Undo.
 */
export function applyOps(before: BudgetPlanCategory[], ops: readonly PlanOp[], opts: OpsOptions): OpsResult {
  let lines = before
  const applied: PlanOp[] = []
  const rejected: OpsResult['rejected'] = []
  for (const op of ops) {
    const reason = check(lines, op, opts)
    if (reason) {
      rejected.push({ op, reason })
      continue
    }
    lines = apply(lines, op, opts)
    applied.push(op)
  }
  return { lines, applied, rejected, diff: diffLines(before, lines) }
}
