import type { DraftLine, PlanDraft } from '@/lib/budget/facts'

export interface ValidationContext {
  income: number
  /** Live monthly total of active subscriptions (base). */
  subscriptionsLive: number
  /** Live monthly minimum per debt id (base). */
  debtMinimums: Record<string, number>
  /** Planned monthly draw per goal id from the goal's own funding settings (base). */
  goalMonthly: Record<string, number>
  /** A line above this multiple of income is treated as a model slip. */
  maxLineFactor?: number
}

export type IssueCode = 'noIncome' | 'overAssigned' | 'goalShortfall'

export interface ValidationIssue {
  code: IssueCode
  /** Blocking issues stop the plan from being confirmed as is. */
  blocking: boolean
  amount?: number
}

export interface ValidationResult {
  ok: boolean
  draft: PlanDraft
  issues: ValidationIssue[]
  /** Human-readable notes on what was repaired (for logs and the review's "estimated" notice). */
  changes: string[]
}

/** Trimming order when the plan is over-assigned. Bills, subscriptions and debts are never trimmed. */
const TRIM_ORDER: { match: (l: DraftLine) => boolean; floor: number }[] = [
  { match: (l) => l.block === 'grow' && l.isSavings, floor: 0 },
  { match: (l) => l.block === 'everyday', floor: 0.7 },
  { match: (l) => l.block === 'goals' && l.linkType === 'none', floor: 0 },
  { match: (l) => l.block === 'safety', floor: 0 },
]

const cents = (n: number) => Math.round(n * 100) / 100
const tolerance = (income: number) => Math.max(1, income * 0.002)

function bufferLine(amount: number): DraftLine {
  return {
    block: 'grow', name: 'Buffer', icon: 'layers', amount, linkType: 'none', linkIds: [], dueDay: null,
    essential: false, isSavings: true, expenseCategories: [],
    rationale: 'Unassigned money flows to your safety net', confidence: 'high',
  }
}

/**
 * Makes an AI or engine draft safe to show: clamps slips, restores live values for linked lines,
 * drops lines that point at things that do not exist, removes duplicates and balances the sum to income.
 * Pure: returns a repaired copy plus what is still wrong.
 */
export function repairDraft(input: PlanDraft, ctx: ValidationContext): ValidationResult {
  const changes: string[] = []
  const issues: ValidationIssue[] = []
  const cap = ctx.income * (ctx.maxLineFactor ?? 10)

  if (!(ctx.income > 0)) {
    return { ok: false, draft: input, issues: [{ code: 'noIncome', blocking: true }], changes }
  }

  let lines: DraftLine[] = []
  const seen = new Set<string>()
  for (const raw of input.lines) {
    const line = { ...raw }
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      line.amount = 0
      changes.push(`clamped ${line.name}`)
    } else if (line.amount > cap) {
      line.amount = cap
      changes.push(`capped ${line.name}`)
    }

    if (line.linkType === 'subscriptions') {
      line.amount = ctx.subscriptionsLive
    } else if (line.linkType === 'debts') {
      const id = line.linkIds[0]
      if (!(id in ctx.debtMinimums)) {
        changes.push(`dropped ${line.name}`)
        continue
      }
      line.amount = ctx.debtMinimums[id]
    } else if (line.linkType === 'goal') {
      const id = line.linkIds[0]
      if (!(id in ctx.goalMonthly)) {
        changes.push(`dropped ${line.name}`)
        continue
      }
      const live = ctx.goalMonthly[id]
      if (line.amount > live) line.amount = live
      else if (line.amount < live) issues.push({ code: 'goalShortfall', blocking: false, amount: live - line.amount })
    }

    const key = line.name.trim().toLowerCase()
    if (seen.has(key)) {
      let n = 2
      while (seen.has(`${line.name} ${n}`.trim().toLowerCase())) n++
      line.name = `${line.name} ${n}`
      changes.push(`renamed duplicate ${line.name}`)
    }
    seen.add(line.name.trim().toLowerCase())
    lines.push(line)
  }

  let free = cents(ctx.income - lines.reduce((s, l) => s + l.amount, 0))
  const tol = tolerance(ctx.income)

  if (free > tol) {
    const buffer = lines.find((l) => l.block === 'grow' && l.name.toLowerCase() === 'buffer')
    if (buffer) buffer.amount = cents(buffer.amount + free)
    else lines = [...lines, bufferLine(free)]
    changes.push('assigned the remainder to the buffer')
    free = 0
  } else if (free < -tol) {
    let needed = -free
    for (const { match, floor } of TRIM_ORDER) {
      const group = lines.filter(match)
      const capacity = group.reduce((s, l) => s + l.amount * (1 - floor), 0)
      if (capacity <= 0) continue
      const take = Math.min(needed, capacity)
      for (const l of group) l.amount = cents(l.amount - (take * (l.amount * (1 - floor))) / capacity)
      needed = cents(needed - take)
      changes.push('trimmed to fit income')
      if (needed <= tol) break
    }
    free = needed > tol ? -needed : 0
    if (free < 0) issues.push({ code: 'overAssigned', blocking: true, amount: needed })
  }

  // Cents drift from proportional trims lands on the buffer so the sum is exact.
  const drift = cents(ctx.income - lines.reduce((s, l) => s + l.amount, 0))
  if (free >= 0 && drift !== 0 && Math.abs(drift) <= tol) {
    const buffer = lines.find((l) => l.block === 'grow' && l.name.toLowerCase() === 'buffer')
    if (buffer && buffer.amount + drift >= 0) buffer.amount = cents(buffer.amount + drift)
    else if (drift > 0) lines = [...lines, bufferLine(drift)]
  }

  const total = lines.reduce((s, l) => s + l.amount, 0)
  const draft: PlanDraft = { ...input, lines, free: cents(ctx.income - total) }
  return { ok: !issues.some((i) => i.blocking), draft, issues, changes }
}
