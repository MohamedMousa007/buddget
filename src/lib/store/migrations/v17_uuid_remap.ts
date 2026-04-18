/**
 * Persist migration v16 → v17: rewrite every non-UUID client id as a proper
 * v4 UUID so Supabase's `uuid`-typed primary-key columns accept the upsert.
 * Pre-v17 ids were `${Date.now()}_${rand}` strings which silently failed
 * every list-sync, leaving user data only in the legacy JSONB blob.
 *
 * FK integrity is preserved: the migration builds a per-table `old → new`
 * map and rewrites every reference (`paymentMethodId`, `debtId`,
 * `budgetPlanId`, subcategory refs, debt-payment back-refs, recurring-*
 * links, etc.) so in-store relationships stay intact.
 *
 * The built-in default payment method (`pm_default_cash`) keeps its sentinel
 * string id — the sync mapper filters it out from upserts, and expense rows
 * that point at it emit `payment_method_id: null` on sync (DB column is
 * nullable).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DEFAULT_CASH_ID = 'pm_default_cash'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rand().slice(1)}-${rand()}${rand()}${rand()}`
}

type Row = Record<string, unknown>

/** Mint a UUID for every row whose id is not already a UUID. Preserves the
 *  default-cash sentinel. Returns the remap so FK fields can be rewritten. */
function remapRowIds(list: unknown): { rows: Row[]; map: Map<string, string> } {
  const map = new Map<string, string>()
  if (!Array.isArray(list)) return { rows: [], map }
  const out = (list as Row[]).map((row) => {
    const currentId = typeof row.id === 'string' ? row.id : ''
    if (!currentId) return row
    if (currentId === DEFAULT_CASH_ID) return row
    if (isUuid(currentId)) return row
    const nextId = newUuid()
    map.set(currentId, nextId)
    return { ...row, id: nextId }
  })
  return { rows: out, map }
}

function rewriteRef(row: Row, field: string, map: Map<string, string>): Row {
  const current = row[field]
  if (typeof current !== 'string') return row
  const mapped = map.get(current)
  if (!mapped) return row
  return { ...row, [field]: mapped }
}

function rewriteSubcategories(plans: Row[]): Row[] {
  return plans.map((plan) => {
    const cats = Array.isArray(plan.categories) ? (plan.categories as Row[]) : []
    const catMap = new Map<string, string>()
    const nextCats = cats.map((c) => {
      const id = typeof c.id === 'string' ? c.id : ''
      if (!id || isUuid(id)) return c
      const next = newUuid()
      catMap.set(id, next)
      return { ...c, id: next }
    })
    // subcategories live inside category.subcategories — rewrite their ids too.
    const finalCats = nextCats.map((c) => {
      const subs = Array.isArray(c.subcategories) ? (c.subcategories as Row[]) : []
      const nextSubs = subs.map((s) => {
        const sid = typeof s.id === 'string' ? s.id : ''
        if (!sid || isUuid(sid)) return s
        return { ...s, id: newUuid() }
      })
      return { ...c, subcategories: nextSubs }
    })
    return { ...plan, categories: finalCats }
  })
}

/**
 * Walk the persisted state, rewriting legacy string ids into UUIDs and
 * updating every FK reference that points at them. Returns a shallow-merged
 * copy — original input is untouched.
 */
export function migrateIdsToUuid(persisted: Row): Row {
  const out: Row = { ...persisted }

  // Build id-remap for every list slice that has a `uuid` column in Postgres.
  const incomes = remapRowIds(out.incomeSources)
  const payments = remapRowIds(out.paymentMethods)
  const debts = remapRowIds(out.debts)
  const debtPayments = remapRowIds(out.debtPayments)
  const recurringDebtPayments = remapRowIds(out.recurringDebtPayments)
  const subscriptions = remapRowIds(out.subscriptions)
  const expenses = remapRowIds(out.expenses)
  const recurringExpenses = remapRowIds(out.recurringExpenses)
  const goals = remapRowIds(out.goals)
  const savingsAccounts = remapRowIds(out.savingsAccounts)
  const savingsHoldings = remapRowIds(out.savingsHoldings)
  const savingsTransactions = remapRowIds(out.savingsTransactions)
  const recurringSavingsDeposits = remapRowIds(out.recurringSavingsDeposits)
  const budgetPlans = remapRowIds(out.budgetPlans)

  // Union remap used to rewrite cross-slice references.
  const combined = new Map<string, string>()
  for (const { map } of [
    incomes,
    payments,
    debts,
    debtPayments,
    recurringDebtPayments,
    subscriptions,
    expenses,
    recurringExpenses,
    goals,
    savingsAccounts,
    savingsHoldings,
    savingsTransactions,
    recurringSavingsDeposits,
    budgetPlans,
  ]) {
    for (const [k, v] of map) combined.set(k, v)
  }

  // Rewrite known FK fields — every reference in the store that names
  // another row by id gets pointed at the new UUID.
  const rewriteList = (
    rows: Row[],
    fields: readonly string[],
  ): Row[] => rows.map((r) => fields.reduce((acc, f) => rewriteRef(acc, f, combined), r))

  out.incomeSources = incomes.rows
  out.paymentMethods = payments.rows
  out.debts = debts.rows
  out.debtPayments = rewriteList(debtPayments.rows, ['debtId', 'paymentMethodId'])
  out.recurringDebtPayments = rewriteList(recurringDebtPayments.rows, ['debtId', 'paymentMethodId'])
  out.subscriptions = rewriteList(subscriptions.rows, ['paymentMethodId'])
  out.expenses = rewriteList(expenses.rows, ['paymentMethodId', 'recurringId', 'debtId'])
  out.recurringExpenses = rewriteList(recurringExpenses.rows, ['paymentMethodId'])
  out.goals = rewriteList(goals.rows, ['linkedSavingsAccountIds', 'linkedDebtIds'] as const)
  out.savingsAccounts = savingsAccounts.rows
  out.savingsHoldings = rewriteList(savingsHoldings.rows, ['accountId'])
  out.savingsTransactions = rewriteList(savingsTransactions.rows, ['accountId', 'paymentMethodId'])
  out.recurringSavingsDeposits = rewriteList(recurringSavingsDeposits.rows, ['accountId', 'paymentMethodId'])
  out.budgetPlans = rewriteSubcategories(budgetPlans.rows)

  // Top-level active plan pointer.
  if (typeof out.activeBudgetPlanId === 'string') {
    const mapped = combined.get(out.activeBudgetPlanId)
    if (mapped) out.activeBudgetPlanId = mapped
  }

  return out
}
