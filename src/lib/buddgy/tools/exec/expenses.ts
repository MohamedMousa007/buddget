import { defineTools } from '@/lib/buddgy/tools/define'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { selectActivePlan } from '@/lib/budget/activePlan'
import { planRowNames } from '@/lib/budget/budgetPlans'
import { AUTO_DATE_WINDOW_DAYS, AUTO_MAX_AMOUNT_BASE, claimAutoSlot, withinDays } from '@/lib/buddgy/tools/autoApplyGuard'
import { checkAmount } from '@/lib/ai/legacyGuards'
import { categoryLabelFor } from '@/lib/i18n/categoryLabel'
import { labels } from '@/lib/buddgy/tools/copy'
import type { EditableField, Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import { refOf, resolveByRefOrName, resolveRef } from '@/lib/buddgy/tools/refs'
import { expensesSpecs } from '@/lib/buddgy/tools/specs/expenses'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import type { Currency, Expense, ExpenseCategory, FinanceStore } from '@/lib/store/types'
import { projectedIncomeForMonth } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { localTodayISO } from '@/lib/utils/localDate'

/** A single add under this share of monthly income may apply with just an Undo. */
const AUTO_APPLY_INCOME_SHARE = 0.05

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000

function resolveCategory(s: FinanceStore, input: unknown): string | null {
  const wanted = text(input, 60)?.toLowerCase()
  if (!wanted) return null
  const standard = EXPENSE_ENTRY_CATEGORIES.find((c) => c.toLowerCase() === wanted)
  if (standard) return standard
  const plan = selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)
  return plan ? (planRowNames(plan).find((n) => n.toLowerCase() === wanted) ?? null) : null
}

function categoryField(s: FinanceStore, current: string, label: string, locale: 'en' | 'ar'): EditableField {
  const plan = selectActivePlan(s.budgetPlans, s.activeBudgetPlanId)
  const rows = plan ? planRowNames(plan) : []
  const values = [...new Set([current, ...EXPENSE_ENTRY_CATEGORIES, ...rows])]
  return { key: 'category', label, kind: 'select', value: current, options: values.map((v) => ({ value: v, label: categoryLabelFor(locale, v) })) }
}

function methodField(s: FinanceStore, currentId: string, label: string): EditableField {
  return {
    key: 'method',
    label,
    kind: 'select',
    value: currentId ? refOf(currentId) : '',
    options: s.paymentMethods.map((m) => ({ value: refOf(m.id), label: m.name })),
  }
}

function resolveMethod(s: FinanceStore, input: unknown): { id: string; guessed: boolean } | { error: ReturnType<typeof fail> } {
  if (input === undefined || input === null || input === '') {
    const usual = s.paymentMethods.find((m) => m.isDefault) ?? s.paymentMethods[0]
    return { id: usual?.id ?? '', guessed: false }
  }
  const hit = resolveByRefOrName(s.paymentMethods, input, (m) => m.name)
  if (hit.kind === 'one') return { id: hit.item.id, guessed: false }
  const choices = (hit.kind === 'many' ? hit.items : s.paymentMethods).map((m) => ({ id: refOf(m.id), label: m.name }))
  return {
    error: fail(
      hit.kind === 'many' ? 'Several payment methods match.' : 'No payment method matches.',
      'Ask which one, or omit method to use the usual one.',
      choices,
    ),
  }
}

const monthIncome = (s: FinanceStore): number =>
  projectedIncomeForMonth(s.incomeSources, s.settings.baseCurrency, s.exchangeRates, ui().monthFilter, s.settings.monthStartDay)

/** Entries proposed moments ago, so two identical calls in one model turn cannot both auto-apply. */
const proposedLately = new Map<string, number>()
const SAME_TURN_MS = 15_000

/** Forgets recent proposals (tests share this module state; a real session never needs it). */
export function resetSameTurnMemory(): void {
  proposedLately.clear()
}

function seenJustNow(key: string): boolean {
  const now = Date.now()
  for (const [k, at] of proposedLately) if (now - at > SAME_TURN_MS) proposedLately.delete(k)
  const seen = proposedLately.has(key)
  proposedLately.set(key, now)
  return seen
}

function previewFields(s: FinanceStore, ctx: ToolContext, e: { description: string; amount: number; currency: string; category: string; date: string; paymentMethodId: string }): EditableField[] {
  const L = labels(ctx.locale)
  return [
    { key: 'description', label: L.description, kind: 'text', value: e.description },
    { key: 'amount', label: L.amount, kind: 'amount', value: String(e.amount), currency: e.currency },
    categoryField(s, e.category, L.category, ctx.locale),
    methodField(s, e.paymentMethodId, L.method),
    { key: 'date', label: L.date, kind: 'date', value: e.date },
  ]
}

function buildAddExpense(args: Record<string, unknown>, ctx: ToolContext, claimSlot: boolean): ProposeResult {
  const s = fin()
  const L = labels(ctx.locale)
  const description = text(args.description, 80)
  const amount = num(args.amount)
  if (!description) return fail('An expense needs a description.')
  if (amount === undefined) return fail('The amount must be above zero.')
  const amountError = checkAmount(amount)
  if (amountError) return fail(amountError)
  const currency = (text(args.currency, 8)?.toUpperCase() ?? s.settings.baseCurrency) as Currency
  const inBase = tryConvertCurrency(amount, currency, s.settings.baseCurrency, s.exchangeRates)
  if (inBase === null) return fail(`No exchange rate from ${currency} to ${s.settings.baseCurrency}.`, 'Ask for the amount in the base currency.')
  const date = args.date === undefined ? localTodayISO(ctx.now) : parseIsoDate(args.date)
  if (!date) return fail('The date must be a real date like 2026-10-19.')
  const requestedCategory = args.category === undefined ? null : resolveCategory(s, args.category)
  if (args.category !== undefined && requestedCategory === null) return fail('Unknown category.', `Use one of: ${EXPENSE_ENTRY_CATEGORIES.join(', ')}.`)
  const category = requestedCategory ?? 'Other'
  const method = resolveMethod(s, args.method)
  if ('error' in method) return method.error

  const recent = s.expenses.find(
    (e) => e.amount === amount && e.date === date && e.description.toLowerCase() === description.toLowerCase() && Date.now() - Date.parse(e.createdAt) < DUPLICATE_WINDOW_MS,
  )
  const income = monthIncome(s)
  const small = income > 0 && inBase <= income * AUTO_APPLY_INCOME_SHARE
  const twin = !ctx.revising && seenJustNow(`${description.toLowerCase()}|${amount}|${currency}|${date}`)
  const duplicate = Boolean(recent) || twin
  const eligible =
    small &&
    !duplicate &&
    requestedCategory !== null &&
    args.recurring !== true &&
    !ctx.afterRead &&
    inBase <= AUTO_MAX_AMOUNT_BASE &&
    withinDays(date, localTodayISO(ctx.now), AUTO_DATE_WINDOW_DAYS)
  const risk = eligible && (!claimSlot || claimAutoSlot()) ? 'auto' : 'approve'
  const methodName = s.paymentMethods.find((m) => m.id === method.id)?.name

  const clean = { description, amount, currency, category, date, method: method.id ? refOf(method.id) : undefined, notes: text(args.notes, 200), recurring: args.recurring === true }
  return ok(
    makeProposal({
      tool: 'add_expense',
      args: clean,
      risk,
      summary: `Pending approval: add ${description} ${money(amount, currency)} on ${date}.`,
      preview: {
        domain: 'expenses',
        tone: 'add',
        title: L.addExpense,
        rows: [
          { label: L.description, value: description },
          { label: L.amount, value: money(amount, currency) },
          { label: L.category, value: categoryLabelFor(ctx.locale, category) },
          ...(methodName ? [{ label: L.method, value: methodName }] : []),
          { label: L.date, value: date },
        ],
        fields: previewFields(s, ctx, { description, amount, currency, category, date, paymentMethodId: method.id }),
        ...(duplicate ? { effect: L.duplicateWarning } : {}),
      },
    }),
  )
}

const add_expense: WriteImpl = {
  propose: (args, ctx) => buildAddExpense(args, ctx, true),
  apply(proposal: Proposal, ctx) {
    const again = buildAddExpense(proposal.args, ctx, false)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const s = fin()
    const before = new Set(s.expenses.map((e) => e.id))
    const method = resolveMethod(s, a.method)
    if ('error' in method) return { ok: false, error: 'That payment method no longer exists.' }
    s.addExpense({
      date: a.date as string,
      description: a.description as string,
      category: a.category as ExpenseCategory,
      amount: a.amount as number,
      currency: a.currency as Currency,
      paymentMethodId: method.id,
      isRecurring: a.recurring === true,
      ...(a.notes ? { notes: a.notes as string } : {}),
    })
    const created = fin().expenses.find((e) => !before.has(e.id))
    return {
      ok: true,
      message: `${a.description as string} · ${money(a.amount as number, a.currency as string)}`,
      undo: created ? () => fin().deleteExpense(created.id) : undefined,
    }
  },
}

type Changes = Partial<Pick<Expense, 'description' | 'amount' | 'currency' | 'category' | 'date' | 'paymentMethodId' | 'notes' | 'amountInBaseCurrency'>>

function lockedReason(e: Expense, ctx: ToolContext): string | null {
  const L = labels(ctx.locale)
  if (e.isDebtPayment || e.linkedDebtId || e.linkedDebtPaymentId) return L.debtLinked
  if (e.receiptId) return L.receiptLinked
  return null
}

const update_expense: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = labels(ctx.locale)
    const hit = resolveRef(s.expenses, args.ref)
    if (hit.kind === 'none') return fail('No expense has that ref.', 'Find it with search_expenses first.')
    if (hit.kind === 'many') return fail('That ref matches several expenses.', 'Use a longer ref from search_expenses.')
    const e = hit.item
    const locked = lockedReason(e, ctx)
    if (locked) return fail(locked)

    const changes: Changes = {}
    const rows: { label: string; value: string; before: string }[] = []
    const description = text(args.description, 80)
    if (description && description !== e.description) {
      changes.description = description
      rows.push({ label: L.description, before: e.description, value: description })
    }
    let amount = e.amount
    let currency = e.currency
    if (args.amount !== undefined) {
      const n = num(args.amount)
      if (n === undefined || n <= 0) return fail('The amount must be above zero.')
      amount = n
    }
    if (args.currency !== undefined) currency = (text(args.currency, 8)?.toUpperCase() ?? e.currency) as Currency
    if (amount !== e.amount || currency !== e.currency) {
      const inBase = tryConvertCurrency(amount, currency, s.settings.baseCurrency, s.exchangeRates)
      if (inBase === null) return fail(`No exchange rate from ${currency} to ${s.settings.baseCurrency}.`)
      changes.amount = amount
      changes.currency = currency
      changes.amountInBaseCurrency = inBase
      rows.push({ label: L.amount, before: money(e.amount, e.currency), value: money(amount, currency) })
    }
    if (args.category !== undefined) {
      const category = resolveCategory(s, args.category)
      if (!category) return fail('Unknown category.', `Use one of: ${EXPENSE_ENTRY_CATEGORIES.join(', ')}.`)
      if (category !== e.category) {
        changes.category = category
        rows.push({ label: L.category, before: categoryLabelFor(ctx.locale, e.category), value: categoryLabelFor(ctx.locale, category) })
      }
    }
    if (args.date !== undefined) {
      const date = parseIsoDate(args.date)
      if (!date) return fail('The date must be a real date like 2026-10-19.')
      if (date !== e.date) {
        changes.date = date
        rows.push({ label: L.date, before: e.date, value: date })
      }
    }
    if (args.method !== undefined) {
      const method = resolveMethod(s, args.method)
      if ('error' in method) return method.error
      if (method.id !== e.paymentMethodId) {
        changes.paymentMethodId = method.id
        const name = (id: string) => s.paymentMethods.find((m) => m.id === id)?.name ?? '—'
        rows.push({ label: L.method, before: name(e.paymentMethodId), value: name(method.id) })
      }
    }
    const notes = text(args.notes, 200)
    if (notes !== undefined && notes !== (e.notes ?? '')) {
      changes.notes = notes
      rows.push({ label: L.notes, before: e.notes ?? '—', value: notes })
    }
    if (rows.length === 0) return fail('Nothing would change.')

    return ok(
      makeProposal({
        tool: 'update_expense',
        args: { ref: refOf(e.id), ...Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'ref')) },
        risk: 'approve',
        summary: `Pending approval: change ${e.description}.`,
        preview: {
          domain: 'expenses',
          tone: 'change',
          title: `${L.changeExpense}: ${e.description}`,
          rows,
          fields: previewFields(s, ctx, {
            description: changes.description ?? e.description,
            amount,
            currency,
            category: changes.category ?? e.category,
            date: changes.date ?? e.date,
            paymentMethodId: changes.paymentMethodId ?? e.paymentMethodId,
          }),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = update_expense.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const s = fin()
    const e = resolveRef(s.expenses, again.proposal.args.ref)
    if (e.kind !== 'one') return { ok: false, error: 'That expense no longer exists.' }
    const target = e.item
    const a = again.proposal.args
    const patch: Changes = {}
    const description = text(a.description, 80)
    if (description) patch.description = description
    if (a.amount !== undefined || a.currency !== undefined) {
      const amount = num(a.amount) ?? target.amount
      const currency = (text(a.currency, 8)?.toUpperCase() ?? target.currency) as Currency
      patch.amount = amount
      patch.currency = currency
      patch.amountInBaseCurrency = tryConvertCurrency(amount, currency, s.settings.baseCurrency, s.exchangeRates) ?? 0
    }
    if (a.category !== undefined) patch.category = resolveCategory(s, a.category) ?? target.category
    if (a.date !== undefined) patch.date = parseIsoDate(a.date) ?? target.date
    if (a.method !== undefined) {
      const m = resolveMethod(s, a.method)
      if (!('error' in m)) patch.paymentMethodId = m.id
    }
    if (a.notes !== undefined) patch.notes = text(a.notes, 200)
    const previous: Changes = {}
    for (const key of Object.keys(patch) as (keyof Changes)[]) (previous as Record<string, unknown>)[key] = target[key]
    s.updateExpense(target.id, patch as Partial<Expense>)
    return { ok: true, message: target.description, undo: () => fin().updateExpense(target.id, previous as Partial<Expense>) }
  },
}

const delete_expense: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = labels(ctx.locale)
    const hit = resolveRef(s.expenses, args.ref)
    if (hit.kind === 'none') return fail('No expense has that ref.', 'Find it with search_expenses first.')
    if (hit.kind === 'many') return fail('That ref matches several expenses.', 'Use a longer ref from search_expenses.')
    const e = hit.item
    const locked = lockedReason(e, ctx)
    if (locked) return fail(locked)
    return ok(
      makeProposal({
        tool: 'delete_expense',
        args: { ref: refOf(e.id) },
        risk: 'strong',
        summary: `Pending approval: delete ${e.description}.`,
        preview: {
          domain: 'expenses',
          tone: 'danger',
          title: `${L.deleteExpense}: ${e.description}`,
          rows: [
            { label: L.amount, value: money(e.amount, e.currency) },
            { label: L.category, value: categoryLabelFor(ctx.locale, e.category) },
            { label: L.date, value: e.date },
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_expense.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = resolveRef(fin().expenses, again.proposal.args.ref)
    if (hit.kind !== 'one') return { ok: false, error: 'That expense no longer exists.' }
    const removed = hit.item
    fin().deleteExpense(removed.id)
    return { ok: true, message: removed.description, undo: () => fin().restoreExpense(removed) }
  },
}

export const expensesTools = defineTools(expensesSpecs, { add_expense, update_expense, delete_expense })
