import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { AppSettings, BudgetPlan, BudgetPlanActivation } from '@/lib/store/types'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import { mergeList } from './merge'
import type { Snapshot } from './snapshot'
import { memoryFromRow } from './mappers/buddgyMemoryMapper'
import { accountAdjustmentFromRow } from './mappers/accountAdjustmentMapper'
import { activationFromRow } from './mappers/budgetActivationMapper'
import { assembleBudgetPlan } from './mappers/budgetPlanMapper'
import { debtFromRow } from './mappers/debtMapper'
import { debtPaymentFromRow } from './mappers/debtPaymentMapper'
import { expenseFromRow } from './mappers/expenseMapper'
import { goalFromRow } from './mappers/goalMapper'
import { incomeEventFromRow } from './mappers/incomeEventMapper'
import { incomeSourceFromRow } from './mappers/incomeSourceMapper'
import { investmentHoldingFromRow } from './mappers/investmentHoldingMapper'
import { paymentMethodFromRow } from './mappers/paymentMethodMapper'
import { profileFromRow } from './mappers/profileMapper'
import { receiptFromRow } from './mappers/receiptMapper'
import { recurringDebtPaymentFromRow } from './mappers/recurringDebtPaymentMapper'
import { recurringExpenseFromRow } from './mappers/recurringExpenseMapper'
import { recurringSavingsDepositFromRow } from './mappers/recurringSavingsDepositMapper'
import { savingsAccountFromRow } from './mappers/savingsAccountMapper'
import { savingsTransactionFromRow } from './mappers/savingsTransactionMapper'
import { settingsFromRow } from './mappers/settingsMapper'
import { subscriptionFromRow } from './mappers/subscriptionMapper'

type Row = Record<string, unknown> & { id?: string; deleted_at?: string | null }
type WithId = { id: string; updatedAt?: string; createdAt?: string }

/** Rows that changed: the live ones to merge in, and the ids that were deleted. */
export interface ListDelta<T> {
  upserts: T[]
  deletedIds: string[]
}

export interface MappedDelta {
  /** Server time of the pull; the next pull asks for what changed after it. */
  cursor: string
  profile: ReturnType<typeof profileFromRow> | null
  settings: AppSettings | null
  paymentMethods: ListDelta<Snapshot['paymentMethods'][number]>
  incomeSources: ListDelta<Snapshot['incomeSources'][number]>
  incomeEvents: ListDelta<Snapshot['incomeEvents'][number]>
  expenses: ListDelta<Snapshot['expenses'][number]>
  receipts: ListDelta<Snapshot['receipts'][number]>
  recurringExpenses: ListDelta<Snapshot['recurringExpenses'][number]>
  subscriptions: ListDelta<Snapshot['subscriptions'][number]>
  debts: ListDelta<Snapshot['debts'][number]>
  debtPayments: ListDelta<Snapshot['debtPayments'][number]>
  recurringDebtPayments: ListDelta<Snapshot['recurringDebtPayments'][number]>
  savingsAccounts: ListDelta<Snapshot['savingsAccounts'][number]>
  investmentHoldings: ListDelta<Snapshot['investmentHoldings'][number]>
  savingsTransactions: ListDelta<Snapshot['savingsTransactions'][number]>
  recurringSavingsDeposits: ListDelta<Snapshot['recurringSavingsDeposits'][number]>
  goals: ListDelta<Snapshot['goals'][number]>
  buddgyMemories: ListDelta<Snapshot['buddgyMemories'][number]>
  accountAdjustments: ListDelta<Snapshot['accountAdjustments'][number]>
  budgetPlans: BudgetPlan[]
  deletedBudgetPlanIds: string[]
  budgetPlanActivations: BudgetPlanActivation[]
  /**
   * Set when this was a full pull taken because the device's cursor was too old for tombstones to be kept (the cursor
   * it had). Local rows absent from the server and last touched before it were deleted long ago: drop them instead of
   * pushing them back.
   */
  staleBefore: string | null
}

interface SyncPullPayload {
  cursor: string
  needs_full?: boolean
  has_profile: boolean
  profile: Database['public']['Tables']['profiles']['Row'] | null
  settings: Database['public']['Tables']['user_settings']['Row'] | null
  lists: Record<string, Row[]>
  budget_plans: Database['public']['Tables']['budget_plans']['Row'][]
  budget_plans_deleted: string[]
  budget_categories: Database['public']['Tables']['budget_categories']['Row'][]
  budget_subcategories: Database['public']['Tables']['budget_subcategories']['Row'][]
  budget_plan_activations: Database['public']['Tables']['budget_plan_activations']['Row'][]
}

function listDelta<T>(rows: Row[] | undefined, fromRow: (row: never) => T): ListDelta<T> {
  const out: ListDelta<T> = { upserts: [], deletedIds: [] }
  for (const r of rows ?? []) {
    if (r.deleted_at) out.deletedIds.push(r.id as string)
    else out.upserts.push(fromRow(r as never))
  }
  return out
}

/** One request for everything that changed since `since` (null = the live rows, i.e. a full first pull). Null when the account has no profile yet. */
export async function pullDelta(client: SupabaseClient<Database>, since: string | null): Promise<MappedDelta | null> {
  const { data, error } = await client.rpc('sync_pull_v2', since ? { p_since: since } : {})
  if (error) throw new Error(error.message)
  const p = data as unknown as SyncPullPayload | null
  if (p?.needs_full && since) {
    const full = await pullDelta(client, null)
    return full && { ...full, staleBefore: since }
  }
  if (!p?.has_profile) return null

  const l = p.lists
  return {
    cursor: p.cursor,
    profile: p.profile ? profileFromRow(p.profile) : null,
    // settingsFromRow needs the currencies from the profile; they are filled in by applyDelta when only settings changed.
    settings: p.settings ? settingsFromRow(p.settings, { baseCurrency: DEFAULT_SETTINGS.baseCurrency, secondaryCurrency: null }) : null,
    paymentMethods: listDelta(l.payment_methods, paymentMethodFromRow),
    incomeSources: listDelta(l.income_sources, incomeSourceFromRow),
    incomeEvents: listDelta(l.income_events, incomeEventFromRow),
    expenses: listDelta(l.expenses, expenseFromRow),
    receipts: listDelta(l.receipts, receiptFromRow),
    recurringExpenses: listDelta(l.recurring_expenses, recurringExpenseFromRow),
    subscriptions: listDelta(l.subscriptions, subscriptionFromRow),
    debts: listDelta(l.debts, debtFromRow),
    debtPayments: listDelta(l.debt_payments, debtPaymentFromRow),
    recurringDebtPayments: listDelta(l.recurring_debt_payments, recurringDebtPaymentFromRow),
    savingsAccounts: listDelta(l.savings_accounts, savingsAccountFromRow),
    investmentHoldings: listDelta(l.savings_holdings, investmentHoldingFromRow),
    savingsTransactions: listDelta(l.savings_transactions, savingsTransactionFromRow),
    recurringSavingsDeposits: listDelta(l.recurring_savings_deposits, recurringSavingsDepositFromRow),
    goals: listDelta(l.goals, goalFromRow),
    buddgyMemories: listDelta(l.buddgy_memories, memoryFromRow),
    accountAdjustments: listDelta(l.account_adjustments, accountAdjustmentFromRow),
    budgetPlans: p.budget_plans.map((plan) => assembleBudgetPlan({ plan, categories: p.budget_categories, subcategories: p.budget_subcategories })),
    deletedBudgetPlanIds: p.budget_plans_deleted,
    budgetPlanActivations: p.budget_plan_activations.map(activationFromRow),
    staleBefore: null,
  }
}

function applyListWith<T extends WithId>(local: T[], d: ListDelta<T>, staleBefore: string | null): T[] {
  const dead = new Set(d.deletedIds)
  const live = new Set(d.upserts.map((r) => r.id))
  const cutoff = staleBefore === null ? NaN : Date.parse(staleBefore)
  const gone = (r: T) => !Number.isNaN(cutoff) && !live.has(r.id) && !!r.updatedAt && Date.parse(r.updatedAt) <= cutoff
  return mergeList(local, d.upserts).filter((r) => !dead.has(r.id) && !gone(r))
}

/**
 * Folds a pull into the local snapshot. Rows that changed on the server are merged in (the newer `updatedAt` wins, as in
 * the full merge), rows deleted on the server are removed, and everything else is left alone. Settings and profile are
 * taken from the server only when they changed (the caller has already flushed local edits).
 */
export function applyDelta(local: Snapshot, d: MappedDelta): Snapshot {
  const profileResult = d.profile
  const baseCurrency = profileResult?.extras.baseCurrency ?? local.settings.baseCurrency
  const secondaryCurrency = profileResult ? (profileResult.extras.secondaryCurrency ?? null) : (local.settings.secondaryCurrency ?? null)
  const settings: AppSettings = d.settings
    ? { ...d.settings, weekStartDay: d.settings.weekStartDay ?? local.settings.weekStartDay, baseCurrency, secondaryCurrency }
    : profileResult
      ? { ...local.settings, baseCurrency, secondaryCurrency }
      : local.settings

  const deadPlans = new Set(d.deletedBudgetPlanIds)
  const applyList = <T extends WithId>(local: T[], delta: ListDelta<T>): T[] => applyListWith(local, delta, d.staleBefore)
  return {
    profile: profileResult?.profile ?? local.profile,
    settings,
    // A profile in the delta is the server's current row (local edits were flushed first), so a cleared plan or cleared notes stay cleared.
    financialGoalsNotes: profileResult ? profileResult.extras.financialGoalsNotes : local.financialGoalsNotes,
    activeBudgetPlanId: profileResult ? profileResult.extras.activeBudgetPlanId : local.activeBudgetPlanId,
    paymentMethods: applyList(local.paymentMethods as WithId[], d.paymentMethods as ListDelta<WithId>) as Snapshot['paymentMethods'],
    incomeSources: applyList(local.incomeSources, d.incomeSources),
    incomeEvents: applyList(local.incomeEvents, d.incomeEvents),
    expenses: applyList(local.expenses, d.expenses),
    receipts: applyList(local.receipts, d.receipts),
    recurringExpenses: applyList(local.recurringExpenses as WithId[], d.recurringExpenses as ListDelta<WithId>) as Snapshot['recurringExpenses'],
    subscriptions: applyList(local.subscriptions as WithId[], d.subscriptions as ListDelta<WithId>) as Snapshot['subscriptions'],
    debts: applyList(local.debts, d.debts),
    debtPayments: applyList(local.debtPayments, d.debtPayments),
    recurringDebtPayments: applyList(local.recurringDebtPayments, d.recurringDebtPayments),
    savingsAccounts: applyList(local.savingsAccounts, d.savingsAccounts),
    investmentHoldings: applyList(local.investmentHoldings, d.investmentHoldings),
    savingsTransactions: applyList(local.savingsTransactions as WithId[], d.savingsTransactions as ListDelta<WithId>) as Snapshot['savingsTransactions'],
    recurringSavingsDeposits: applyList(local.recurringSavingsDeposits, d.recurringSavingsDeposits),
    goals: applyList(local.goals, d.goals),
    buddgyMemories: applyList(local.buddgyMemories as WithId[], d.buddgyMemories as ListDelta<WithId>) as Snapshot['buddgyMemories'],
    accountAdjustments: applyList(local.accountAdjustments as WithId[], d.accountAdjustments as ListDelta<WithId>) as Snapshot['accountAdjustments'],
    budgetPlans: applyListWith(local.budgetPlans as WithId[], { upserts: d.budgetPlans as WithId[], deletedIds: d.deletedBudgetPlanIds }, null) as Snapshot['budgetPlans'],
    budgetPlanActivations: (mergeList(local.budgetPlanActivations as WithId[], d.budgetPlanActivations as WithId[]) as Snapshot['budgetPlanActivations']).filter((a) => !deadPlans.has(a.planId)),
  }
}
