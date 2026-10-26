import { defineTools } from '@/lib/buddgy/tools/define'
import { balanceCopy, blockName, budgetLabels } from '@/lib/buddgy/tools/exec/budgetCopy'
import type { PreviewRow, Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import { restoreRows, revertRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { refOf, resolveByRefOrName, resolveRef } from '@/lib/buddgy/tools/refs'
import { budgetSpecs } from '@/lib/buddgy/tools/specs/budget'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, text } from '@/lib/buddgy/tools/writeKit'
import { isLivePlan, selectActivePlan } from '@/lib/budget/activePlan'
import { cycleKeyOf } from '@/lib/budget/activations'
import { BLOCK_META, BUDGET_BLOCKS, lineBlock, planIncome } from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase, planCategoryCurrency } from '@/lib/budget/budgetPlans'
import { debtPaidByDebt } from '@/lib/budget/liveLinks'
import { ledgerDebtPaidByDebt, spendByLine } from '@/lib/budget/lineSpend'
import { applyOps, type OpsResult, type PlanOp } from '@/lib/budget/ops'
import { summarizePlan } from '@/lib/budget/planSummary'
import type { BudgetBlock, BudgetPlan, BudgetPlanCategory, FinanceStore } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { calculateCategorySpending, filterExpensesByMonth, projectedIncomeForMonth } from '@/lib/utils/calculations'

const MAX_OPS = 12
const MAX_LINES = 30
const MAX_PLANS = 15
const round0 = (n: number) => Math.round(n)
const round2 = (n: number) => Math.round(n * 100) / 100
const isLinked = (c: BudgetPlanCategory) => (c.linkType ?? 'none') !== 'none'
const newId = () => crypto.randomUUID()

function incomeOf(s: FinanceStore, plan: BudgetPlan): number {
  const blocked = s.settings.noIncomeDeclared === true && s.incomeSources.length === 0 && s.incomeEvents.length === 0
  const projected = blocked
    ? 0
    : projectedIncomeForMonth(s.incomeSources, s.settings.baseCurrency, s.exchangeRates, ui().monthFilter, s.settings.monthStartDay)
  return planIncome(plan, projected)
}

function spentByLine(s: FinanceStore, plan: BudgetPlan): Record<string, number> {
  const base = s.settings.baseCurrency
  const month = ui().monthFilter
  const startDay = s.settings.monthStartDay
  const spendingByEnum = calculateCategorySpending(filterExpensesByMonth(s.expenses, month, startDay), base, s.exchangeRates)
  const debtCtx = { debtPayments: s.debtPayments, expenses: s.expenses, base, rates: s.exchangeRates, goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable }
  const debtPaid = debtPaidByDebt(s.debts, debtCtx, month, startDay)
  const debtLedgerPaid = ledgerDebtPaidByDebt(s.expenses, month, startDay, base, s.exchangeRates)
  return spendByLine({ plan, spendingByEnum, debtPaid, debtLedgerPaid }).byLine
}

const activePlan = (s: FinanceStore) => selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)

const get_budget: ReadImpl = (args) => {
  const s = fin()
  const plan = activePlan(s)
  if (!plan) return { plan: null, note: 'No budget plan yet. Offer the Budget Studio.' }
  const base = s.settings.baseCurrency
  const rates = s.exchangeRates
  const income = incomeOf(s, plan)
  const sum = summarizePlan(plan, income, base, rates)
  const spent = spentByLine(s, plan)
  const block = BUDGET_BLOCKS.find((b) => b === args.block)
  const rows = plan.categories.filter((c) => !block || lineBlock(c) === block)
  const lines = rows.slice(0, MAX_LINES).map((c) => {
    const planned = effectivePlanCategoryAmountInBase(c, base, rates)
    const used = spent[c.id]
    return {
      ref: refOf(c.id),
      name: c.name,
      block: lineBlock(c),
      planned: round0(planned),
      ...(used === undefined ? {} : { spent: round0(used), left: round0(planned - used) }),
      ...(c.locked ? { locked: true } : {}),
      ...(isLinked(c) ? { linked: true } : {}),
    }
  })
  return {
    plan: { ref: refOf(plan.id), name: plan.name },
    currency: base,
    month: ui().monthFilter,
    income: round0(income),
    planned: round0(sum.total),
    free: round0(sum.free),
    lines,
    ...(rows.length > MAX_LINES ? { more: rows.length - MAX_LINES } : {}),
  }
}

const list_budget_plans: ReadImpl = () => {
  const s = fin()
  const active = activePlan(s)
  const base = s.settings.baseCurrency
  const plans = [...s.budgetPlans].sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))
  return {
    currency: base,
    plans: plans.slice(0, MAX_PLANS).map((p) => ({
      ref: refOf(p.id),
      name: p.name,
      status: p.status ?? 'ready',
      ...(p.id === active?.id ? { active: true } : {}),
      lines: p.categories.length,
      planned: round0(summarizePlan(p, incomeOf(s, p), base, s.exchangeRates).total),
    })),
    ...(plans.length > MAX_PLANS ? { more: plans.length - MAX_PLANS } : {}),
  }
}

const OP_NAMES = ['set', 'add', 'remove', 'move', 'rename', 'lock'] as const

interface CleanOp {
  op: (typeof OP_NAMES)[number]
  line?: string
  amount?: number
  name?: string
  block?: BudgetBlock
  locked?: boolean
}

function lineChoices(lines: readonly BudgetPlanCategory[]) {
  return lines.map((c) => ({ id: refOf(c.id), label: c.name }))
}

interface LocalSkip {
  name: string
  why: string
}

function parseOps(s: FinanceStore, plan: BudgetPlan, input: unknown): { ops: PlanOp[]; clean: CleanOp[]; skips: LocalSkip[] } | { error: ProposeResult } {
  if (!Array.isArray(input) || input.length === 0) return { error: fail('Send at least one op.') }
  if (input.length > MAX_OPS) return { error: fail(`At most ${MAX_OPS} ops per call.`) }
  const ops: PlanOp[] = []
  const clean: CleanOp[] = []
  const skips: LocalSkip[] = []
  const base = s.settings.baseCurrency
  for (const raw of input as Record<string, unknown>[]) {
    const op = OP_NAMES.find((o) => o === raw?.op)
    if (!op) return { error: fail(`Unknown op "${String(raw?.op)}".`, `Use one of: ${OP_NAMES.join(', ')}.`) }
    const name = text(raw.name, 60)
    const amount = num(raw.amount)
    const block = BUDGET_BLOCKS.find((b) => b === raw.block)

    if (op === 'add') {
      if (!name || amount === undefined || !block) return { error: fail('add needs name, amount and block.') }
      ops.push({ op, line: { block, name, amount, icon: BLOCK_META[block].icon } })
      clean.push({ op, name, amount, block })
      continue
    }

    const hit = resolveByRefOrName(plan.categories, raw.line, (c) => c.name)
    if (hit.kind === 'none') return { error: fail(`No budget line matches "${String(raw.line ?? '')}".`, 'Use a ref from get_budget.', lineChoices(plan.categories).slice(0, MAX_LINES)) }
    if (hit.kind === 'many') return { error: fail('That matches several lines.', 'Ask which one.', lineChoices(hit.items)) }
    const id = hit.item.id
    const line = refOf(id)

    if (op === 'set') {
      if (amount === undefined) return { error: fail('set needs an amount.') }
      clean.push({ op, line, amount })
      const cur = planCategoryCurrency(hit.item, base)
      const inLine = cur === base ? amount : tryConvertCurrency(amount, base, cur, s.exchangeRates)
      if (inLine === null) skips.push({ name: hit.item.name, why: `no exchange rate from ${base} to ${cur}` })
      else ops.push({ op, id, amount: cur === base ? amount : round2(inLine) })
    } else if (op === 'move') {
      if (!block) return { error: fail('move needs a block.', `Use one of: ${BUDGET_BLOCKS.join(', ')}.`) }
      ops.push({ op, id, block })
      clean.push({ op, line, block })
    } else if (op === 'rename') {
      if (!name) return { error: fail('rename needs a new name.') }
      ops.push({ op, id, name })
      clean.push({ op, line, name })
    } else if (op === 'lock') {
      const locked = raw.locked !== false
      ops.push({ op, id, locked })
      clean.push({ op, line, locked })
    } else {
      ops.push({ op, id })
      clean.push({ op, line })
    }
  }
  return { ops, clean, skips }
}

const reasonOf = (r: ProposeResult): string => (r.ok ? '' : r.error)

type AdjustBuilt =
  | { error: ProposeResult }
  | { plan: BudgetPlan; result: OpsResult; changes: number; proposal: Proposal }

function buildAdjust(args: Record<string, unknown>, ctx: ToolContext): AdjustBuilt {
  const s = fin()
  const L = budgetLabels(ctx.locale)
  const c = balanceCopy(ctx.locale)
  const pinned = typeof args.planRef === 'string' ? resolveRef(s.budgetPlans, args.planRef) : null
  const plan = pinned ? (pinned.kind === 'one' ? pinned.item : null) : activePlan(s)
  if (!plan) return { error: fail('There is no active budget plan.', 'Offer the Budget Studio.') }
  const parsed = parseOps(s, plan, args.ops)
  if ('error' in parsed) return parsed

  const base = s.settings.baseCurrency
  const income = incomeOf(s, plan)
  const cap = Math.max(income, 1) * 10
  const converted = parsed.ops.flatMap((o) => (o.op === 'set' && planCategoryCurrency(plan.categories.find((x) => x.id === o.id) as BudgetPlanCategory, base) !== base ? [o.amount] : []))
  const result = applyOps(plan.categories, parsed.ops, { newId, maxAmount: Math.max(cap, ...converted) })

  const nameOf = (op: PlanOp) => (op.op === 'add' ? op.line.name : (plan.categories.find((x) => x.id === op.id)?.name ?? '—'))
  const skipped = [...parsed.skips.map((k) => `${k.name} (${k.why})`), ...result.rejected.map((r) => `${nameOf(r.op)} (${L.reasons[r.reason]})`)]
  if (result.applied.length === 0) return { error: fail('Nothing could be changed.', skipped.join('; ')) }

  const prev = new Map(plan.categories.map((x) => [x.id, x]))
  const rows: PreviewRow[] = []
  const shown = (line: BudgetPlanCategory | undefined, amount: number | null) => {
    const cur = line ? planCategoryCurrency(line, base) : base
    const own = money(amount ?? 0, cur)
    return cur === base ? own : `${own} (${money(tryConvertCurrency(amount ?? 0, cur, base, s.exchangeRates) ?? 0, base)})`
  }
  for (const d of result.diff) {
    const line = prev.get(d.id)
    if (d.kind === 'changed') rows.push({ label: d.name, before: shown(line, d.before), value: shown(line, d.after) })
    else if (d.kind === 'added') rows.push({ label: d.name, before: '—', value: shown(undefined, d.after) })
    else if (d.kind === 'removed') rows.push({ label: d.name, before: shown(line, d.before), value: L.removed })
  }
  for (const line of result.lines) {
    const p = prev.get(line.id)
    if (!p) continue
    if (lineBlock(p) !== lineBlock(line)) rows.push({ label: line.name, before: blockName(ctx.locale, lineBlock(p)), value: blockName(ctx.locale, lineBlock(line)) })
    if (p.name !== line.name) rows.push({ label: L.renamed, before: p.name, value: line.name })
    if (!!p.locked !== !!line.locked) rows.push({ label: line.name, value: line.locked ? L.locked : L.unlocked })
  }
  if (rows.length === 0) return { error: fail('Nothing would change.') }
  const changes = rows.length
  for (const k of parsed.skips) rows.push({ label: L.skipped, value: `${k.name} · ${k.why}` })
  for (const r of result.rejected) rows.push({ label: L.skipped, value: `${nameOf(r.op)} · ${L.reasons[r.reason]}` })

  const total = result.lines.reduce((sum, l) => sum + effectivePlanCategoryAmountInBase(l, base, s.exchangeRates), 0)
  const free = round2(income - total)
  const effect = Math.abs(free) < 0.5 ? c.balanced : free > 0 ? c.left(money(free, base)) : c.over(money(-free, base))

  return {
    plan,
    result,
    changes,
    proposal: makeProposal({
      tool: 'adjust_budget',
      args: { planRef: refOf(plan.id), ops: parsed.clean },
      risk: 'approve',
      summary: `Pending approval: ${changes} change(s) to ${plan.name}.${skipped.length ? ` Skipped: ${skipped.join('; ')}.` : ''}`,
      preview: { domain: 'budget', tone: 'change', title: `${L.adjustBudget}: ${plan.name}`, rows, effect },
    }),
  }
}

const adjust_budget: WriteImpl = {
  propose(args, ctx) {
    const built = buildAdjust(args, ctx)
    return 'error' in built ? built.error : ok(built.proposal)
  },
  apply(proposal, ctx) {
    const built = buildAdjust(proposal.args, ctx)
    if ('error' in built) return { ok: false, error: reasonOf(built.error) }
    if (JSON.stringify(built.proposal.preview) !== JSON.stringify(proposal.preview)) {
      return { ok: false, error: budgetLabels(ctx.locale).stale }
    }
    const { plan, result } = built
    const before = plan.categories
    const keptIds = new Set(result.lines.map((l) => l.id))
    const removedIds = new Set(before.filter((l) => !keptIds.has(l.id)).map((l) => l.id))
    const beforeIds = new Set(before.map((l) => l.id))
    const addedIds = new Set(result.lines.filter((l) => !beforeIds.has(l.id)).map((l) => l.id))
    fin().replaceBudgetPlanCategories(plan.id, result.lines)
    return {
      ok: true,
      message: `${plan.name} · ${balanceCopy(ctx.locale).changes(built.changes)}`,
      undo: () => {
        const current = fin().budgetPlans.find((p) => p.id === plan.id)
        if (!current) return
        const untouched = current.categories.filter((l) => !addedIds.has(l.id) || JSON.stringify(l) !== JSON.stringify(result.lines.find((x) => x.id === l.id)))
        const reverted = revertRows(untouched, before, result.lines, ['name', 'amount', 'block', 'locked'])
        fin().replaceBudgetPlanCategories(plan.id, restoreRows(reverted, before, removedIds))
      },
    }
  },
}

function resolvePlan(args: Record<string, unknown>): { plan: BudgetPlan } | { error: ProposeResult } {
  const s = fin()
  const hit = resolveByRefOrName(s.budgetPlans, args.plan, (p) => p.name)
  if (hit.kind === 'one') return { plan: hit.item }
  const choices = (hit.kind === 'many' ? hit.items : s.budgetPlans).slice(0, MAX_PLANS).map((p) => ({ id: refOf(p.id), label: p.name }))
  return {
    error: fail(hit.kind === 'many' ? 'Several plans match.' : 'No plan matches.', 'Ask which one; refs come from list_budget_plans.', choices),
  }
}

const planRows = (s: FinanceStore, plan: BudgetPlan, ctx: ToolContext, against?: BudgetPlan | null): PreviewRow[] => {
  const L = budgetLabels(ctx.locale)
  const base = s.settings.baseCurrency
  const now = summarizePlan(plan, incomeOf(s, plan), base, s.exchangeRates)
  const was = against ? summarizePlan(against, incomeOf(s, against), base, s.exchangeRates) : null
  const row = (label: string, value: string, before?: string): PreviewRow => ({ label, value, ...(was ? { before: before ?? '—' } : {}) })
  return [
    ...(against ? [{ label: L.plan, before: against.name, value: plan.name }] : []),
    row(L.planned, money(round0(now.total), base), was ? money(round0(was.total), base) : undefined),
    row(L.leftToAssign, money(round0(now.free), base), was ? money(round0(was.free), base) : undefined),
    row(L.savingsRate, `${round0(now.savingsRate)}%`, was ? `${round0(was.savingsRate)}%` : undefined),
    row(L.lines, String(now.lineCount), was ? String(was.lineCount) : undefined),
  ]
}

const activate_budget_plan: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = budgetLabels(ctx.locale)
    const found = resolvePlan(args)
    if ('error' in found) return found.error
    const { plan } = found
    if (!isLivePlan(plan)) return fail('That plan is a draft or archived and cannot be activated.')
    const current = activePlan(s)
    if (current?.id === plan.id) return fail('That plan is already active.')
    return ok(
      makeProposal({
        tool: 'activate_budget_plan',
        args: { plan: refOf(plan.id) },
        risk: 'strong',
        summary: `Pending approval: make ${plan.name} the active budget plan.`,
        preview: { domain: 'budget', tone: 'change', title: L.switchPlan(plan.name), rows: planRows(s, plan, ctx, current) },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = activate_budget_plan.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveRef(fin().budgetPlans, again.proposal.args.plan)
    if (hit.kind !== 'one') return { ok: false, error: budgetLabels(ctx.locale).planGone }
    const s = fin()
    const undo = s.activateBudgetPlan(hit.item.id, cycleKeyOf(ctx.now, s.settings.monthStartDay))
    return { ok: true, message: hit.item.name, undo: () => fin().restoreBudgetActivation(undo) }
  },
}

const delete_budget_plan: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = budgetLabels(ctx.locale)
    const found = resolvePlan(args)
    if ('error' in found) return found.error
    const { plan } = found
    const wasActive = activePlan(s)?.id === plan.id
    const next = wasActive ? selectActivePlan(s.budgetPlans.filter((p) => p.id !== plan.id), null) : null
    const effect = [wasActive ? (next ? L.becomesActive(next.name) : L.noActive) : null, L.undoable].filter(Boolean).join(' ')
    return ok(
      makeProposal({
        tool: 'delete_budget_plan',
        args: { plan: refOf(plan.id) },
        risk: 'strong',
        summary: `Pending approval: delete budget plan ${plan.name}.`,
        preview: { domain: 'budget', tone: 'danger', title: L.deletePlan(plan.name), rows: planRows(s, plan, ctx), effect },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_budget_plan.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveRef(fin().budgetPlans, again.proposal.args.plan)
    if (hit.kind !== 'one') return { ok: false, error: budgetLabels(ctx.locale).planGone }
    const planId = hit.item.id
    const was = { plans: fin().budgetPlans, active: fin().activeBudgetPlanId, log: fin().budgetPlanActivations }
    fin().deleteBudgetPlan(planId)
    const now = { active: fin().activeBudgetPlanId, log: fin().budgetPlanActivations }
    return {
      ok: true,
      message: hit.item.name,
      undo: () =>
        useFinanceStore.setState((st) => {
          const wasIds = new Set(was.log.map((a) => a.id))
          const added = new Set(now.log.filter((a) => !wasIds.has(a.id)).map((a) => a.id))
          const dropped = new Set(was.log.filter((a) => a.planId === planId || !now.log.some((n) => n.id === a.id)).map((a) => a.id))
          return {
            budgetPlans: restoreRows(st.budgetPlans, was.plans, new Set([planId])),
            budgetPlanActivations: restoreRows(st.budgetPlanActivations.filter((a) => !added.has(a.id)), was.log, dropped),
            ...(st.activeBudgetPlanId === now.active ? { activeBudgetPlanId: was.active } : {}),
          }
        }),
    }
  },
}

export const budgetTools = defineTools(budgetSpecs, { get_budget, list_budget_plans, adjust_budget, activate_budget_plan, delete_budget_plan })
