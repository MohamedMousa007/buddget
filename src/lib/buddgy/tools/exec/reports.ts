import { defineTools } from '@/lib/buddgy/tools/define'
import { merchantKey } from '@/lib/ai/buddgyLookup'
import { refOf } from '@/lib/buddgy/tools/refs'
import { reportsSpecs } from '@/lib/buddgy/tools/specs/reports'
import { cycleKeyOf } from '@/lib/budget/activations'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl } from '@/lib/buddgy/tools/types'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { isNonSpendExpense } from '@/lib/constants/categoryMeta'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import type { Expense, FinanceStore } from '@/lib/store/types'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => Math.round(n * 100) / 100

const asDate = (v: unknown): string | undefined => (typeof v === 'string' && DATE_RE.test(v) ? v : undefined)
const asNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const asStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)

/** Spend rows with their base-currency amount; refunded or zero rows carry no spend. */
export function spendRows(s: FinanceStore): { e: Expense; amount: number }[] {
  const base = s.settings.baseCurrency
  return s.expenses
    .map((e) => ({ e, amount: expenseAmountInBase(e, base, s.exchangeRates) }))
    .filter((x) => x.amount > 0 && !isNonSpendExpense(x.e) && x.e.category !== 'Savings')
}

const get_summary: ReadImpl = (args) => {
  const s = fin()
  const monthFilter = typeof args.month === 'string' && MONTH_RE.test(args.month) ? args.month : ui().monthFilter
  const st = computeMonthlyStats({
    expenses: s.expenses,
    incomeSources: s.incomeSources,
    incomeEvents: s.incomeEvents,
    budgetCategories: s.budgetCategories,
    budgetPlans: s.budgetPlans,
    budgetPlanActivations: s.budgetPlanActivations,
    activeBudgetPlanId: s.activeBudgetPlanId,
    savingsHoldings: s.savingsHoldings,
    savingsAccounts: s.savingsAccounts,
    savingsTransactions: s.savingsTransactions,
    debts: s.debts,
    debtPayments: s.debtPayments,
    settings: s.settings,
    exchangeRates: s.exchangeRates,
    goldPricePerGram: s.goldPricePerGram,
    goldPriceAvailable: s.goldPriceAvailable,
    monthFilter,
    trustLocalFinance: true,
  })
  const top = Object.entries(st.categorySpending)
    .filter(([, spent]) => spent > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, spent]) => ({ name, spent: r0(spent), cap: st.categoryBudgetCaps[name] ? r0(st.categoryBudgetCaps[name]) : undefined }))
  return {
    month: monthFilter,
    currency: st.baseCurrency,
    income: r0(st.totalIncome),
    spent: r0(st.totalSpentExcludingSavings),
    budget: r0(st.totalExpenseBudget),
    left_to_spend: r0(st.leftToSpend),
    safe_daily: r0(st.suggestedDaily),
    days_left: st.daysLeft,
    pace: st.paceStatus,
    projected_spend: r0(st.projectedSpend),
    over_budget: st.overBudgetCategories.map((c) => c.category),
    top_categories: top,
    savings_total: r0(st.savingsTotal),
    debt_remaining: r0(st.debtRemainingTotal),
    income_declared: !st.incomeBlocked,
  }
}

const search_expenses: ReadImpl = (args) => {
  const s = fin()
  const base = s.settings.baseCurrency
  const q = asStr(args.q)?.toLowerCase()
  const category = asStr(args.category)?.toLowerCase()
  const methodArg = asStr(args.method)?.toLowerCase()
  const from = asDate(args.from)
  const to = asDate(args.to)
  const min = asNum(args.min)
  const max = asNum(args.max)
  const limit = Math.min(15, Math.max(1, Math.floor(asNum(args.limit) ?? 8)))
  const methodIds = methodArg
    ? new Set(s.paymentMethods.filter((m) => m.name.toLowerCase().includes(methodArg) || refOf(m.id) === methodArg).map((m) => m.id))
    : null

  const rows = spendRows(s).filter(
    ({ e, amount }) =>
      (!from || e.date >= from) &&
      (!to || e.date <= to) &&
      (!q || e.description.toLowerCase().includes(q)) &&
      (!category || e.category.toLowerCase() === category) &&
      (!methodIds || methodIds.has(e.paymentMethodId)) &&
      (min === undefined || amount >= min) &&
      (max === undefined || amount <= max),
  )
  if (rows.length === 0) return { count: 0, total: 0, currency: base, rows: [] }
  const sorted = [...rows].sort((a, b) => (args.sort === 'largest' ? b.amount - a.amount : b.e.date.localeCompare(a.e.date) || b.e.createdAt.localeCompare(a.e.createdAt)))
  const methodName = new Map(s.paymentMethods.map((m) => [m.id, m.name]))
  return {
    count: rows.length,
    total: r2(rows.reduce((sum, x) => sum + x.amount, 0)),
    currency: base,
    rows: sorted.slice(0, limit).map(({ e, amount }) => ({
      ref: refOf(e.id),
      date: e.date,
      desc: e.description,
      amount: r2(amount),
      ...(e.currency !== base ? { original: `${e.currency} ${e.amount}` } : {}),
      category: e.category,
      method: methodName.get(e.paymentMethodId) ?? undefined,
    })),
    ...(rows.length > limit ? { more: rows.length - limit } : {}),
  }
}

const spend_breakdown: ReadImpl = (args) => {
  const s = fin()
  const base = s.settings.baseCurrency
  const from = asDate(args.from)
  const to = asDate(args.to)
  const by = String(args.by)
  const methodName = new Map(s.paymentMethods.map((m) => [m.id, m.name]))
  const rows = spendRows(s).filter(({ e }) => (!from || e.date >= from) && (!to || e.date <= to))
  const key = ({ e }: { e: Expense }) =>
    by === 'method' ? (methodName.get(e.paymentMethodId) ?? 'Unassigned')
    : by === 'month' ? cycleKeyOf(new Date(`${e.date}T00:00:00`), s.settings.monthStartDay)
    : by === 'day' ? e.date
    : by === 'merchant' ? merchantKey(e.description)
    : e.category
  const groups = new Map<string, { sum: number; n: number }>()
  for (const x of rows) {
    const k = key(x)
    const g = groups.get(k) ?? { sum: 0, n: 0 }
    g.sum += x.amount
    g.n += 1
    groups.set(k, g)
  }
  const chronological = by === 'month' || by === 'day'
  const ordered = [...groups].sort((a, b) => (chronological ? a[0].localeCompare(b[0]) : b[1].sum - a[1].sum))
  return {
    by,
    currency: base,
    total: r2(rows.reduce((sum, x) => sum + x.amount, 0)),
    groups: ordered.slice(0, 12).map(([name, g]) => ({ name, amount: r2(g.sum), count: g.n })),
    ...(ordered.length > 12 ? { more: ordered.length - 12 } : {}),
  }
}

export const reportsTools = defineTools(
  reportsSpecs,
  { get_summary, search_expenses, spend_breakdown },
)
