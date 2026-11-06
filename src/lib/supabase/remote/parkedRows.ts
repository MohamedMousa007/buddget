import type { Snapshot } from './snapshot'
import type { ParkedRow } from './sync'

/** The snapshot slice (top-level list) each synced table is delivered through. Categories and subcategories live inside their plan. */
const SLICE_OF_TABLE: Record<string, keyof Snapshot> = {
  payment_methods: 'paymentMethods',
  income_sources: 'incomeSources',
  income_events: 'incomeEvents',
  expenses: 'expenses',
  receipts: 'receipts',
  recurring_expenses: 'recurringExpenses',
  subscriptions: 'subscriptions',
  debts: 'debts',
  debt_payments: 'debtPayments',
  recurring_debt_payments: 'recurringDebtPayments',
  savings_accounts: 'savingsAccounts',
  savings_holdings: 'investmentHoldings',
  savings_transactions: 'savingsTransactions',
  recurring_savings_deposits: 'recurringSavingsDeposits',
  goals: 'goals',
  account_adjustments: 'accountAdjustments',
  buddgy_memories: 'buddgyMemories',
  budget_plans: 'budgetPlans',
  budget_categories: 'budgetPlans',
  budget_subcategories: 'budgetPlans',
  budget_plan_activations: 'budgetPlanActivations',
}

type Row = { id: string }

/**
 * The baseline to keep after a flush that set rows aside: `next`, except that every parked row (or the plan holding a
 * parked category) is put back to what the server last had, or left out when it never had it. The rest of the flush is
 * delivered and recorded; the parked rows still differ from the baseline, so the next flush offers them again and a
 * later edit or a fixed parent lets them through.
 */
export function holdParkedBack(next: Snapshot, delivered: Snapshot, parked: readonly ParkedRow[]): Snapshot {
  if (parked.length === 0) return next
  const roots = new Map<keyof Snapshot, Set<string>>()
  for (const p of parked) {
    const slice = SLICE_OF_TABLE[p.table]
    if (!slice) continue
    if (!roots.has(slice)) roots.set(slice, new Set())
    roots.get(slice)!.add(p.rootId)
  }
  const out = { ...next } as Record<keyof Snapshot, unknown>
  for (const [slice, ids] of roots) {
    const before = new Map((delivered[slice] as unknown as Row[]).map((r) => [r.id, r]))
    out[slice] = (next[slice] as unknown as Row[]).flatMap((r) => (ids.has(r.id) ? (before.has(r.id) ? [before.get(r.id)!] : []) : [r]))
  }
  return out as unknown as Snapshot
}
