import { defineTools } from '@/lib/buddgy/tools/define'
import { goalCategoryName, goalLabels } from '@/lib/buddgy/tools/exec/goalsCopy'
import { restoreRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { inPocketCurrency, ledgerUndo, no, pick, posted, snapshotLedger, type Refusal } from '@/lib/buddgy/tools/exec/wealthKit'
import type { EditableField, PreviewRow, Proposal } from '@/lib/buddgy/tools/proposal'
import { refOf } from '@/lib/buddgy/tools/refs'
import { goalsSpecs } from '@/lib/buddgy/tools/specs/goals'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { buildGoalProgressContext, computeGoalProgress } from '@/lib/goals/computeGoalProgress'
import { withDebtDerived } from '@/lib/goals/debtGoal'
import { periodsUntil } from '@/lib/goals/goalPlan'
import { getGoalStatus } from '@/lib/goals/goalStatus'
import { isEligibleCarryPocket } from '@/lib/savings/monthCarry'
import type { Currency, FinanceStore, Goal, GoalCategory, GoalFundingMode } from '@/lib/store/types'
import { useFinanceStore, goldQuoteOf } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency, tryConvertWithGold } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { localTodayISO } from '@/lib/utils/localDate'

const FUNDING_MODES: readonly GoalFundingMode[] = ['share', 'fixed', 'manual']
const RECENT_MS = 2 * 60_000
const r2 = (n: number) => Math.round(n * 100) / 100
const GOAL_HINT = 'Find it with list_goals first.'
const SAVING_CATEGORIES = GOAL_CATEGORIES.map((c) => c.value).filter((v) => v !== 'debt_freedom' && v !== 'spending_control') as GoalCategory[]

const isSaving = (g: Goal) => g.category !== 'debt_freedom' && g.category !== 'spending_control'

function progress(s: FinanceStore, g: Goal) {
  const ctx = buildGoalProgressContext(s, ui().monthFilter)
  return { ctx, current: computeGoalProgress(g, ctx), shown: withDebtDerived(g, ctx) }
}

const list_goals: ReadImpl = (_args, ctx) => {
  const s = fin()
  const today = localTodayISO(ctx.now)
  const order = (g: Goal) => (g.status === 'active' ? 0 : g.status === 'paused' ? 1 : g.status === 'achieved' ? 2 : 3)
  const sorted = [...s.goals].sort((a, b) => order(a) - order(b) || a.priority - b.priority)
  const rows = sorted.slice(0, 15).map((g) => {
    const { current, shown } = progress(s, g)
    const limit = g.category === 'spending_control'
    const basis = limit ? g.monthlySpendingLimit : shown.targetAmount
    const flag = getGoalStatus({ goal: shown, current, runs: [], now: ctx.now }).kind
    const remaining = shown.targetAmount === null ? 0 : Math.max(0, shown.targetAmount - current)
    const open = g.status === 'active' && isSaving(g) && shown.targetDate
    const overdue = open && shown.targetDate !== null && shown.targetDate < today && remaining > 0
    return {
      ref: refOf(g.id),
      name: g.name,
      cat: g.category,
      state: g.status,
      ccy: g.currency,
      ...(limit ? { limit: basis, spent: r2(current) } : { target: basis === null ? null : r2(basis), saved: r2(current) }),
      ...(basis && basis > 0 ? { pct: Math.min(100, Math.round((current / basis) * 100)) } : {}),
      ...(shown.targetDate ? { date: shown.targetDate } : {}),
      ...(isSaving(g)
        ? {
            funding: g.fundingMode,
            ...(g.fundingMode === 'share' && g.sharePct ? { share: g.sharePct } : {}),
            ...(g.fundingMode === 'fixed' && g.monthlyContribution ? { monthly: g.monthlyContribution } : {}),
          }
        : {}),
      ...(open && !overdue && remaining > 0 ? { need_mo: Math.round(remaining / periodsUntil(ctx.now, shown.targetDate as string, 'monthly')) } : {}),
      ...(overdue ? { flag: 'overdue' } : flag === 'over' || flag === 'due' ? { flag } : {}),
    }
  })
  return { count: s.goals.length, rows, ...(s.goals.length > 15 ? { more: s.goals.length - 15 } : {}) }
}

function resolveGoal(s: FinanceStore, input: unknown) {
  return pick(s.goals, input, (g) => g.name, 'goal', GOAL_HINT)
}

function resolveCurrency(s: FinanceStore, input: unknown, fallback: Currency): { currency: Currency } | { error: Refusal } {
  const currency = (text(input, 8)?.toUpperCase() ?? fallback) as Currency
  if (clampFiatToAllowed(s.settings, currency) !== currency) {
    return { error: no(`${currency} is not an enabled currency in this app.`, 'Ask for the amount in the base currency.') }
  }
  if (tryConvertCurrency(1, currency, s.settings.baseCurrency, s.exchangeRates) === null) {
    return { error: no(`No exchange rate from ${currency} to ${s.settings.baseCurrency}.`, 'Ask for the amount in the base currency.') }
  }
  return { currency }
}

const futureDate = (v: unknown, ctx: ToolContext): string | Refusal => {
  const date = parseIsoDate(v)
  if (!date) return no('The date must be a real date like 2026-10-19.')
  if (date <= localTodayISO(ctx.now)) return no('The target date must be in the future.')
  return date
}

const add_goal: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = goalLabels(ctx.locale)
    const name = text(args.name, 60)
    const target = num(args.target)
    if (!name) return no('A goal needs a name.')
    if (target === undefined || target <= 0) return no('The target must be above zero.')
    const ccy = resolveCurrency(s, args.currency, s.settings.baseCurrency)
    if ('error' in ccy) return ccy.error
    let date: string | null = null
    if (args.date !== undefined) {
      const d = futureDate(args.date, ctx)
      if (typeof d !== 'string') return d
      date = d
    }
    let category: GoalCategory = 'custom'
    if (args.category !== undefined) {
      if (!SAVING_CATEGORIES.includes(args.category as GoalCategory)) return no('Unknown goal category.', `Use one of: ${SAVING_CATEGORIES.join(', ')}.`)
      category = args.category as GoalCategory
    }
    const saved = args.saved === undefined ? 0 : num(args.saved)
    if (saved === undefined || saved < 0) return no('The amount already saved cannot be negative.')

    const duplicate = s.goals.some((g) => g.name.trim().toLowerCase() === name.toLowerCase())
    const clean = { name, target, currency: ccy.currency, category, ...(date ? { date } : {}), ...(saved > 0 ? { saved } : {}) }
    const rows: PreviewRow[] = [
      { label: L.name, value: name },
      { label: L.target, value: money(target, ccy.currency) },
      { label: L.category, value: goalCategoryName(ctx.locale, category) },
      ...(date ? [{ label: L.date, value: date }] : []),
      ...(saved > 0 ? [{ label: L.saved, value: money(saved, ccy.currency) }] : []),
    ]
    const fields: EditableField[] = [
      { key: 'name', label: L.name, kind: 'text', value: name },
      { key: 'target', label: L.target, kind: 'amount', value: String(target), currency: ccy.currency },
      { key: 'date', label: L.date, kind: 'date', value: date ?? '' },
      { key: 'saved', label: L.saved, kind: 'amount', value: String(saved), currency: ccy.currency },
    ]
    return ok(
      makeProposal({
        tool: 'add_goal',
        args: clean,
        risk: 'approve',
        summary: `Pending approval: add goal ${name} of ${money(target, ccy.currency)}.`,
        preview: {
          domain: 'goals',
          tone: 'add',
          title: L.addGoal,
          rows,
          fields,
          effect: [L.newPocket(`${name} pocket`), duplicate ? L.duplicate : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_goal.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const s = fin()
    const name = a.name as string
    const twin = s.goals.some(
      (g) =>
        Date.now() - new Date(g.createdAt).getTime() < RECENT_MS &&
        g.name.trim().toLowerCase() === name.toLowerCase() &&
        g.targetAmount === a.target &&
        g.currency === a.currency,
    )
    if (twin) return { ok: false, error: 'Already added' }
    const ccy = a.currency as Currency
    const category = a.category as GoalCategory
    const goalId = s.addGoal({
      name,
      emoji: GOAL_CATEGORIES.find((c) => c.value === category)?.emoji ?? '✏️',
      category,
      currency: ccy,
      priority: s.goals.reduce((m, g) => Math.max(m, g.priority + 1), 0),
      status: 'active',
      notes: null,
      targetAmount: a.target as number,
      targetDate: (a.date as string | undefined) ?? null,
      monthlySpendingLimit: null,
      linkedSavingsAccountIds: [],
      linkedDebtIds: [],
      fundingMode: 'manual',
      sharePct: null,
      monthlyContribution: null,
      frequency: 'monthly',
    })
    const pocketId = s.addSavingsAccount({ name: `${name} pocket`, category: 'savings', type: 'vault', currency: ccy })
    s.updateGoal(goalId, { linkedSavingsAccountIds: [pocketId] })
    if (typeof a.saved === 'number' && a.saved > 0) {
      s.depositToSavings(pocketId, a.saved, ccy, name, { mode: 'declare', source: 'goal_opening' })
    }
    return {
      ok: true,
      message: `${name} · ${money(a.target as number, ccy)}`,
      undo: () => {
        fin().deleteGoal(goalId)
        fin().deleteSavingsAccount(pocketId)
      },
    }
  },
}

interface UpdatePlan {
  goal: Goal
  patch: Partial<Goal>
  rows: PreviewRow[]
  fields: EditableField[]
  reaches: boolean
}

function planUpdate(args: Record<string, unknown>, ctx: ToolContext): UpdatePlan | Refusal {
  const s = fin()
  const L = goalLabels(ctx.locale)
  const hit = resolveGoal(s, args.goal)
  if ('error' in hit) return hit.error
  const goal = hit.item
  const limit = goal.category === 'spending_control'
  const patch: Partial<Goal> = {}
  const rows: PreviewRow[] = []
  const today = localTodayISO(ctx.now)
  let replan = false

  const name = text(args.name, 60)
  if (name && name !== goal.name) {
    patch.name = name
    rows.push({ label: L.name, before: goal.name, value: name })
  }

  let target = limit ? goal.monthlySpendingLimit : goal.targetAmount
  if (args.target !== undefined) {
    if (goal.category === 'debt_freedom') return no('A debt goal follows its debts, so its target cannot be edited.')
    const n = num(args.target)
    if (n === undefined || n <= 0) return no('The target must be above zero.')
    if (n !== target) {
      if (limit) patch.monthlySpendingLimit = n
      else {
        patch.targetAmount = n
        replan = true
      }
      rows.push({ label: limit ? L.limit : L.target, before: target === null ? '—' : money(target, goal.currency), value: money(n, goal.currency) })
      target = n
    }
  }

  const funding = args.funding === undefined && args.sharePct === undefined && args.monthly === undefined
  if (args.date !== undefined) {
    if (!isSaving(goal)) return no('Only a savings goal has a target date to edit.')
    const d = futureDate(args.date, ctx)
    if (typeof d !== 'string') return d
    if (d !== goal.targetDate) {
      patch.targetDate = d
      replan = true
      rows.push({ label: L.date, before: goal.targetDate ?? '—', value: d })
    }
  }

  if (!funding) {
    if (!isSaving(goal)) return no('Only a savings goal has funding.')
    if (args.funding !== undefined && !FUNDING_MODES.includes(args.funding as GoalFundingMode)) return no('Funding must be share, fixed or manual.')
    const mode = (args.funding ?? goal.fundingMode) as GoalFundingMode
    if (args.sharePct !== undefined && mode !== 'share') return no('A share only applies when funding is "share".', 'Send funding "share" with it.')
    if (args.monthly !== undefined && mode !== 'fixed') return no('A monthly amount only applies when funding is "fixed".', 'Send funding "fixed" with it.')
    const sharePct = mode === 'share' ? (args.sharePct === undefined ? goal.sharePct : num(args.sharePct)) : null
    const monthly = mode === 'fixed' ? (args.monthly === undefined ? goal.monthlyContribution : num(args.monthly)) : null
    if (mode === 'share' && (sharePct === undefined || sharePct === null || sharePct <= 0 || sharePct > 100)) return no('A share needs a percentage from 1 to 100.')
    if (mode === 'fixed' && (monthly === undefined || monthly === null || monthly <= 0)) return no('A fixed funding needs a monthly amount above zero.')
    if (mode !== goal.fundingMode) {
      rows.push({ label: L.funding, before: L.modes[goal.fundingMode], value: L.modes[mode] })
    }
    if (sharePct !== goal.sharePct && mode === 'share') rows.push({ label: L.share, before: goal.sharePct === null ? '—' : `${goal.sharePct}%`, value: `${sharePct}%` })
    if (monthly !== goal.monthlyContribution && mode === 'fixed') {
      rows.push({ label: L.monthly, before: goal.monthlyContribution === null ? '—' : money(goal.monthlyContribution, goal.currency), value: money(monthly as number, goal.currency) })
    }
    if (mode !== goal.fundingMode || sharePct !== goal.sharePct || monthly !== goal.monthlyContribution) {
      patch.fundingMode = mode
      patch.sharePct = sharePct as number | null
      patch.monthlyContribution = monthly as number | null
      replan = true
    }
  }
  if (rows.length === 0) return no('Nothing would change.')
  if (replan) patch.planStart = today

  const { current } = progress(s, goal)
  const fields: EditableField[] = [
    { key: 'name', label: L.name, kind: 'text', value: patch.name ?? goal.name },
    ...(target !== null ? [{ key: 'target', label: limit ? L.limit : L.target, kind: 'amount' as const, value: String(target), currency: goal.currency }] : []),
    ...(isSaving(goal) ? [{ key: 'date', label: L.date, kind: 'date' as const, value: patch.targetDate ?? goal.targetDate ?? '' }] : []),
  ]
  return { goal, patch, rows, fields, reaches: isSaving(goal) && goal.status === 'active' && patch.targetAmount != null && current + 0.01 >= patch.targetAmount }
}

const update_goal: WriteImpl = {
  propose(args, ctx) {
    const plan = planUpdate(args, ctx)
    if ('ok' in plan) return plan
    const L = goalLabels(ctx.locale)
    return ok(
      makeProposal({
        tool: 'update_goal',
        args: { ...args, goal: refOf(plan.goal.id) },
        risk: 'approve',
        summary: `Pending approval: change goal ${plan.goal.name}.`,
        preview: {
          domain: 'goals',
          tone: 'change',
          title: `${L.changeGoal}: ${plan.goal.name}`,
          rows: plan.rows,
          fields: plan.fields,
          ...(plan.reaches ? { effect: L.willAchieve } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const plan = planUpdate(proposal.args, ctx)
    if ('ok' in plan) return { ok: false, error: plan.error }
    const previous: Record<string, unknown> = {}
    for (const key of Object.keys(plan.patch) as (keyof Goal)[]) previous[key] = plan.goal[key]
    const id = plan.goal.id
    const before = { status: plan.goal.status, achievedAt: plan.goal.achievedAt }
    fin().updateGoal(id, plan.patch)
    return { ok: true, message: plan.patch.name ?? plan.goal.name, undo: () => fin().updateGoal(id, { ...previous, ...before } as Partial<Goal>) }
  },
}

interface FundPlan {
  goal: Goal
  pocketId: string | null
  amount: number
  currency: Currency
  mode: 'allocate' | 'declare'
  proposal: Proposal
}

function planFund(args: Record<string, unknown>, ctx: ToolContext): FundPlan | Refusal {
  const s = fin()
  const L = goalLabels(ctx.locale)
  const hit = resolveGoal(s, args.goal)
  if ('error' in hit) return hit.error
  const goal = hit.item
  if (!isSaving(goal)) return no('Only a savings goal holds money. A debt goal follows its debts.')
  if (goal.status === 'achieved' || goal.status === 'cancelled') return no(`This goal is already ${goal.status}.`)
  const amount = num(args.amount)
  if (amount === undefined || amount <= 0) return no('The amount must be above zero.')
  const ccy = resolveCurrency(s, args.currency, goal.currency)
  if ('error' in ccy) return ccy.error
  if (args.mode !== undefined && args.mode !== 'allocate' && args.mode !== 'declare') return no('mode must be allocate or declare.')
  const mode = args.mode === 'declare' ? 'declare' : 'allocate'

  const pocket = s.savingsAccounts.find((a) => goal.linkedSavingsAccountIds.includes(a.id) && isEligibleCarryPocket(a))
  const target = pocket ?? { currency: goal.currency, name: `${goal.name} pocket` }
  const landed = inPocketCurrency(s, amount, ccy.currency, target)
  if ('error' in landed) return no(landed.error)
  const { current } = progress(s, goal)
  const inGoal = tryConvertWithGold(landed.amount, target.currency, goal.currency, s.exchangeRates, s.settings.baseCurrency, goldQuoteOf(s))
  if (inGoal === null) return no(`No exchange rate from ${target.currency} to ${goal.currency}.`, 'Ask for the amount in the goal currency.')
  const inBase = tryConvertWithGold(amount, ccy.currency, s.settings.baseCurrency, s.exchangeRates, s.settings.baseCurrency, goldQuoteOf(s)) ?? amount
  const after = current + inGoal

  const rows: PreviewRow[] = [
    { label: L.amount, value: money(amount, ccy.currency) },
    { label: L.pocket, value: target.name },
    { label: L.source, value: L.sources[mode] },
    ...(goal.targetAmount ? [{ label: L.saved, before: money(current, goal.currency), value: money(after, goal.currency) }] : []),
  ]
  const effect = [
    mode === 'allocate' ? L.allocateEffect(money(inBase, s.settings.baseCurrency)) : L.declareEffect,
    pocket ? '' : L.newPocket(target.name),
    goal.targetAmount && current + 0.01 < goal.targetAmount && after + 0.01 >= goal.targetAmount ? L.willAchieve : '',
  ].filter(Boolean).join(' ')

  const clean = { goal: refOf(goal.id), amount, currency: ccy.currency, mode }
  const proposal = makeProposal({
      tool: 'add_to_goal',
      args: clean,
      risk: 'approve',
      summary: `Pending approval: add ${money(amount, ccy.currency)} to ${goal.name}.`,
      preview: {
        domain: 'goals',
        tone: 'add',
        title: `${L.fundGoal}: ${goal.name}`,
        rows,
        fields: [
          { key: 'amount', label: L.amount, kind: 'amount', value: String(amount), currency: ccy.currency },
          { key: 'mode', label: L.source, kind: 'select', value: mode, options: (['allocate', 'declare'] as const).map((v) => ({ value: v, label: L.sources[v] })) },
        ],
        effect,
      },
    })
  return { goal, pocketId: pocket?.id ?? null, amount, currency: ccy.currency, mode, proposal }
}

const add_to_goal: WriteImpl = {
  propose(args, ctx) {
    const plan = planFund(args, ctx)
    return 'ok' in plan ? plan : ok(plan.proposal)
  },
  apply(proposal, ctx) {
    const plan = planFund(proposal.args, ctx)
    if ('ok' in plan) return { ok: false, error: plan.error }
    const { goal } = plan
    const s = fin()
    const before = snapshotLedger()
    let pocketId = plan.pocketId
    let created: string | null = null
    if (!pocketId) {
      pocketId = s.addSavingsAccount({ name: `${goal.name} pocket`, category: 'savings', type: 'vault', currency: goal.currency })
      created = pocketId
      s.updateGoal(goal.id, { linkedSavingsAccountIds: [...goal.linkedSavingsAccountIds, pocketId] })
    }
    s.depositToSavings(pocketId, plan.amount, plan.currency, goal.name, { mode: plan.mode })
    if (!posted(before)) {
      if (created) {
        fin().updateGoal(goal.id, { linkedSavingsAccountIds: goal.linkedSavingsAccountIds })
        fin().deleteSavingsAccount(created)
      }
      return { ok: false, error: 'The deposit was not recorded.' }
    }
    const revert = ledgerUndo(before)
    return {
      ok: true,
      message: `${goal.name} · ${money(plan.amount, plan.currency)}`,
      undo: () => {
        revert()
        if (created) fin().deleteSavingsAccount(created)
      },
    }
  },
}

function planAchieve(args: Record<string, unknown>): { goal: Goal } | Refusal {
  const hit = resolveGoal(fin(), args.goal)
  if ('error' in hit) return hit.error
  if (hit.item.status === 'achieved') return no('This goal is already achieved.')
  return { goal: hit.item }
}

const achieve_goal: WriteImpl = {
  propose(args, ctx) {
    const plan = planAchieve(args)
    if ('ok' in plan) return plan
    const L = goalLabels(ctx.locale)
    const g = plan.goal
    const { current, shown } = progress(fin(), g)
    return ok(
      makeProposal({
        tool: 'achieve_goal',
        args: { goal: refOf(g.id) },
        risk: 'approve',
        summary: `Pending approval: mark goal ${g.name} achieved.`,
        preview: {
          domain: 'goals',
          tone: 'change',
          title: `${L.achieveGoal}: ${g.name}`,
          rows: [
            { label: L.saved, value: money(current, g.currency) },
            ...(shown.targetAmount ? [{ label: L.target, value: money(shown.targetAmount, g.currency) }] : []),
          ],
        },
      }),
    )
  },
  apply(proposal) {
    const plan = planAchieve(proposal.args)
    if ('ok' in plan) return { ok: false, error: plan.error }
    const { id, status, achievedAt, name } = plan.goal
    fin().achieveGoal(id)
    return { ok: true, message: name, undo: () => fin().updateGoal(id, { status, achievedAt }) }
  },
}

const delete_goal: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = goalLabels(ctx.locale)
    const hit = resolveGoal(s, args.goal)
    if ('error' in hit) return hit.error
    const g = hit.item
    const { current } = progress(s, g)
    const pockets = s.savingsAccounts.filter((a) => g.linkedSavingsAccountIds.includes(a.id))
    return ok(
      makeProposal({
        tool: 'delete_goal',
        args: { goal: refOf(g.id) },
        risk: 'strong',
        summary: `Pending approval: delete goal ${g.name}.`,
        preview: {
          domain: 'goals',
          tone: 'danger',
          title: `${L.deleteGoal}: ${g.name}`,
          rows: [
            ...(isSaving(g) ? [{ label: L.saved, value: money(current, g.currency) }] : []),
            ...pockets.map((p) => ({ label: L.pocket, value: `${p.name} · ${money(p.currentBalance, p.currency)}` })),
          ],
          effect: pockets.length > 0 ? L.keepPocket : L.noPocket,
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_goal.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveGoal(fin(), again.proposal.args.goal)
    if ('error' in hit) return { ok: false, error: 'That goal no longer exists.' }
    const before = fin().goals
    fin().deleteGoal(hit.item.id)
    return {
      ok: true,
      message: hit.item.name,
      undo: () => useFinanceStore.setState((st) => ({ goals: restoreRows(st.goals, before, new Set([hit.item.id])) })),
    }
  },
}

export const goalsTools = defineTools(goalsSpecs, { list_goals, add_goal, update_goal, add_to_goal, achieve_goal, delete_goal })
