import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Snapshot } from './snapshot'
import type { HasId } from './types'
import { diffLists, diffSingleton } from './diff'
import { profileToRow, profileFromRow } from './mappers/profileMapper'
import { settingsToRow, settingsFromRow } from './mappers/settingsMapper'
import { paymentMethodToRow, paymentMethodFromRow } from './mappers/paymentMethodMapper'
import { incomeSourceToRow, incomeSourceFromRow } from './mappers/incomeSourceMapper'
import { incomeEventToRow, incomeEventFromRow } from './mappers/incomeEventMapper'
import { expenseToRow, expenseFromRow } from './mappers/expenseMapper'
import { receiptToRow, receiptFromRow } from './mappers/receiptMapper'
import { recurringExpenseToRow, recurringExpenseFromRow } from './mappers/recurringExpenseMapper'
import { subscriptionToRow, subscriptionFromRow } from './mappers/subscriptionMapper'
import { debtToRow, debtFromRow } from './mappers/debtMapper'
import { debtPaymentToRow, debtPaymentFromRow } from './mappers/debtPaymentMapper'
import { recurringDebtPaymentToRow, recurringDebtPaymentFromRow } from './mappers/recurringDebtPaymentMapper'
import { savingsAccountToRow, savingsAccountFromRow } from './mappers/savingsAccountMapper'
import { savingsHoldingToRow, savingsHoldingFromRow } from './mappers/savingsHoldingMapper'
import { savingsTransactionToRow, savingsTransactionFromRow } from './mappers/savingsTransactionMapper'
import { recurringSavingsDepositToRow, recurringSavingsDepositFromRow } from './mappers/recurringSavingsDepositMapper'
import { goalToRow, goalFromRow } from './mappers/goalMapper'
import {
  budgetPlanToRow,
  budgetCategoryToRow,
  budgetSubcategoryToRow,
  assembleBudgetPlan,
} from './mappers/budgetPlanMapper'
import type { Currency } from '@/lib/store/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

type Client = SupabaseClient<Database>
type TableName = keyof Database['public']['Tables']

export interface FlushResult {
  anyError: boolean
  errors: string[]
  writes: number
}

class OpRunner {
  errors: string[] = []
  writes = 0
  private ops: Promise<unknown>[] = []

  constructor(private client: Client) {}

  /** Upsert a batch of rows to a table. Supabase PostgrestFilterBuilder is thenable, so `await` works. */
  upsert<T extends TableName>(table: T, rows: readonly Database['public']['Tables'][T]['Insert'][], label: string) {
    if (rows.length === 0) return
    // Cast to `never` to sidestep the huge union PostgREST exposes.
    const promise = (this.client.from(table) as never as {
      upsert: (r: unknown) => Promise<{ error: { message: string } | null }>
    }).upsert(rows)
    this.ops.push(
      promise.then((res) => {
        this.writes++
        if (res.error) this.errors.push(`${label}: ${res.error.message}`)
      })
    )
  }

  delete(table: TableName, ids: readonly string[], label: string) {
    if (ids.length === 0) return
    const promise = (this.client.from(table) as never as {
      delete: () => { in: (col: string, vals: readonly string[]) => Promise<{ error: { message: string } | null }> }
    })
      .delete()
      .in('id', ids)
    this.ops.push(
      promise.then((res) => {
        this.writes++
        if (res.error) this.errors.push(`${label}: ${res.error.message}`)
      })
    )
  }

  /**
   * Soft-delete variant: stamps `deleted_at = now()` instead of
   * removing the row. User-owned array tables route through this path
   * (see `emitList`) so deletions stay reconcilable across devices.
   * Hydrate hooks filter `deleted_at IS NULL` so the UI keeps behaving
   * as if the row is gone.
   */
  tombstone(table: TableName, ids: readonly string[], label: string) {
    if (ids.length === 0) return
    const promise = (this.client.from(table) as never as {
      update: (patch: { deleted_at: string }) => {
        in: (col: string, vals: readonly string[]) => Promise<{ error: { message: string } | null }>
      }
    })
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
    this.ops.push(
      promise.then((res) => {
        this.writes++
        if (res.error) this.errors.push(`${label}: ${res.error.message}`)
      })
    )
  }

  async drain(): Promise<FlushResult> {
    await Promise.all(this.ops)
    return { anyError: this.errors.length > 0, errors: this.errors, writes: this.writes }
  }
}

function emitList<T extends HasId, TN extends TableName>(
  runner: OpRunner,
  table: TN,
  next: readonly T[],
  prev: readonly T[],
  toRow: (x: T, userId: string) => Database['public']['Tables'][TN]['Insert'],
  userId: string
) {
  const diff = diffLists(next, prev)
  const writes = [...diff.inserts, ...diff.updates].map((x) => toRow(x, userId))
  runner.upsert(table, writes, `${String(table)}.upsert`)
  // User-owned tables soft-delete: stamp `deleted_at = now()` so the
  // deletion is reconcilable across devices. Hydrate filters
  // `deleted_at IS NULL` so the UI still treats the row as gone.
  runner.tombstone(table, diff.deletes, `${String(table)}.tombstone`)
}

/**
 * Diff prev → next and emit per-table writes in parallel.
 */
export async function flushDiff(
  client: Client,
  userId: string,
  prev: Snapshot,
  next: Snapshot
): Promise<FlushResult> {
  const runner = new OpRunner(client)

  // Singletons
  const profileExtras = {
    financialGoalsNotes: next.financialGoalsNotes,
    activeBudgetPlanId: next.activeBudgetPlanId,
    baseCurrency: next.settings.baseCurrency,
    secondaryCurrency: next.settings.secondaryCurrency ?? null,
  }
  const prevProfileSig = {
    profile: prev.profile,
    extras: {
      financialGoalsNotes: prev.financialGoalsNotes,
      activeBudgetPlanId: prev.activeBudgetPlanId,
      baseCurrency: prev.settings.baseCurrency,
      secondaryCurrency: prev.settings.secondaryCurrency ?? null,
    },
  }
  const nextProfileSig = { profile: next.profile, extras: profileExtras }
  if (diffSingleton(nextProfileSig, prevProfileSig) != null) {
    runner.upsert('profiles', [profileToRow(next.profile, profileExtras, userId)], 'profiles.upsert')
  }
  if (diffSingleton(next.settings, prev.settings) != null) {
    runner.upsert('user_settings', [settingsToRow(next.settings, userId)], 'user_settings.upsert')
  }

  // Array slices — the built-in `pm_default_cash` sentinel is kept in-store
  // for a frictionless add-expense UX but never synced: its non-UUID id
  // would be rejected by the `payment_methods.id uuid` column, and FKs that
  // pointed at it are null-emitted by the expense / debt-payment mappers.
  const nextPayments = next.paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID)
  const prevPayments = prev.paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID)
  emitList(runner, 'payment_methods', nextPayments, prevPayments, paymentMethodToRow, userId)
  emitList(runner, 'income_sources', next.incomeSources, prev.incomeSources, incomeSourceToRow, userId)
  emitList(runner, 'income_events', next.incomeEvents, prev.incomeEvents, incomeEventToRow, userId)
  // Receipts MUST commit before expenses: `expenses.receipt_id` FK will reject
  // the expense insert if the receipt row isn't visible yet. Drain receipts in a
  // dedicated pass so Postgres sees the committed row before the expense upsert runs.
  const receiptRunner = new OpRunner(client)
  emitList(receiptRunner, 'receipts', next.receipts, prev.receipts, receiptToRow, userId)
  const receiptResult = await receiptRunner.drain()
  runner.errors.push(...receiptResult.errors)
  runner.writes += receiptResult.writes
  emitList(runner, 'expenses', next.expenses, prev.expenses, expenseToRow, userId)
  emitList(runner, 'recurring_expenses', next.recurringExpenses, prev.recurringExpenses, recurringExpenseToRow, userId)
  emitList(runner, 'subscriptions', next.subscriptions, prev.subscriptions, subscriptionToRow, userId)
  emitList(runner, 'debts', next.debts, prev.debts, debtToRow, userId)
  emitList(runner, 'debt_payments', next.debtPayments, prev.debtPayments, debtPaymentToRow, userId)
  emitList(runner, 'recurring_debt_payments', next.recurringDebtPayments, prev.recurringDebtPayments, recurringDebtPaymentToRow, userId)
  emitList(runner, 'savings_accounts', next.savingsAccounts, prev.savingsAccounts, savingsAccountToRow, userId)
  emitList(runner, 'savings_holdings', next.savingsHoldings, prev.savingsHoldings, savingsHoldingToRow, userId)
  emitList(runner, 'savings_transactions', next.savingsTransactions, prev.savingsTransactions, savingsTransactionToRow, userId)
  emitList(runner, 'recurring_savings_deposits', next.recurringSavingsDeposits, prev.recurringSavingsDeposits, recurringSavingsDepositToRow, userId)
  emitList(runner, 'goals', next.goals, prev.goals, goalToRow, userId)

  flushBudgetPlans(runner, userId, prev, next, next.settings.baseCurrency)

  return runner.drain()
}

function flushBudgetPlans(runner: OpRunner, userId: string, prev: Snapshot, next: Snapshot, baseCurrency: Currency) {
  const planDiff = diffLists(next.budgetPlans, prev.budgetPlans)
  const planRows = [...planDiff.inserts, ...planDiff.updates].map((p) => budgetPlanToRow(p, userId))
  runner.upsert('budget_plans', planRows, 'budget_plans.upsert')
  runner.tombstone('budget_plans', planDiff.deletes, 'budget_plans.tombstone')

  const nextCats = next.budgetPlans.flatMap((p) =>
    p.categories.map((c, idx) => ({ ...c, _planId: p.id, _sortOrder: idx }))
  )
  const prevCats = prev.budgetPlans.flatMap((p) =>
    p.categories.map((c, idx) => ({ ...c, _planId: p.id, _sortOrder: idx }))
  )
  const catDiff = diffLists(nextCats, prevCats)
  const catRows = [...catDiff.inserts, ...catDiff.updates].map((c) =>
    budgetCategoryToRow(c, c._planId, userId, c._sortOrder, baseCurrency)
  )
  runner.upsert('budget_categories', catRows, 'budget_categories.upsert')
  runner.tombstone('budget_categories', catDiff.deletes, 'budget_categories.tombstone')

  const nextSubs = next.budgetPlans.flatMap((p) =>
    p.categories.flatMap((c) => c.subcategories.map((s, idx) => ({ ...s, _catId: c.id, _sortOrder: idx })))
  )
  const prevSubs = prev.budgetPlans.flatMap((p) =>
    p.categories.flatMap((c) => c.subcategories.map((s, idx) => ({ ...s, _catId: c.id, _sortOrder: idx })))
  )
  const subDiff = diffLists(nextSubs, prevSubs)
  const subRows = [...subDiff.inserts, ...subDiff.updates].map((s) =>
    budgetSubcategoryToRow(s, s._catId, userId, s._sortOrder)
  )
  runner.upsert('budget_subcategories', subRows, 'budget_subcategories.upsert')
  runner.tombstone('budget_subcategories', subDiff.deletes, 'budget_subcategories.tombstone')
}

/**
 * Minimal "always needed" hydration: profiles + user_settings + payment_methods.
 * All per-page hooks add the heavier domains (expenses, debts, etc.) on demand.
 *
 * Returns partial snapshot (array slices default to []) — use as the baseline for
 * the sync-layer diff; per-page hooks can update Zustand independently.
 */
export async function pullCore(client: Client, userId: string): Promise<Snapshot | null> {
  const [profileR, settingsR, pmR] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    client.from('payment_methods').select('*').eq('user_id', userId).is('deleted_at', null),
  ])

  if (!profileR.data) return null

  const { profile, extras } = profileFromRow(profileR.data)
  const secondary = (profileR.data.secondary_currency ?? null) as Currency | null
  const settings = settingsR.data
    ? settingsFromRow(settingsR.data, { baseCurrency: extras.baseCurrency, secondaryCurrency: secondary })
    : {
        baseCurrency: extras.baseCurrency,
        secondaryCurrency: secondary,
        showSecondaryCurrency: false,
        theme: 'dark' as const,
        language: 'en' as const,
        showCentsInDashboard: true,
        monthStartDay: 1,
        budgetEntryMode: 'amount' as const,
        enableAI: true,
        aiProvider: 'gemini' as const,
        noIncomeDeclared: false,
        showAllCurrenciesInForms: true,
        twoFactorEmailEnabled: false,
        legacyOnboardingMigratedAt: null,
        dashboardLayout: 'standard' as const,
        tutorialsCompleted: [] as string[],
        tutorialCurrentStep: null as string | null,
        smsTrackingEnabled: false,
      }

  return {
    profile,
    settings,
    financialGoalsNotes: extras.financialGoalsNotes,
    activeBudgetPlanId: extras.activeBudgetPlanId,
    paymentMethods: (pmR.data ?? []).map(paymentMethodFromRow),
    incomeSources: [],
    incomeEvents: [],
    expenses: [],
    receipts: [],
    recurringExpenses: [],
    subscriptions: [],
    debts: [],
    debtPayments: [],
    recurringDebtPayments: [],
    savingsAccounts: [],
    savingsHoldings: [],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    goals: [],
    budgetPlans: [],
  }
}

/**
 * Fetch every user-owned table in parallel and assemble a Snapshot.
 * Returns null if the user has no `profiles` row yet (unauthenticated race).
 */
export async function pullAll(client: Client, userId: string): Promise<Snapshot | null> {
  const [
    profileR, settingsR,
    pmR, incomeR, incomeEvtR, expenseR, receiptR, recExpR, subR,
    debtR, debtPayR, recDebtR,
    saR, shR, stR, rsdR,
    goalR, planR, catR, subcatR,
  ] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    client.from('payment_methods').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('income_sources').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('income_events').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('expenses').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('receipts').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('recurring_expenses').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('subscriptions').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('debts').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('debt_payments').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('recurring_debt_payments').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('savings_accounts').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('savings_holdings').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('savings_transactions').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('recurring_savings_deposits').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('goals').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('budget_plans').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('budget_categories').select('*').eq('user_id', userId).is('deleted_at', null),
    client.from('budget_subcategories').select('*').eq('user_id', userId).is('deleted_at', null),
  ])

  if (!profileR.data) return null

  const { profile, extras } = profileFromRow(profileR.data)
  const secondary = (profileR.data.secondary_currency ?? null) as Currency | null
  const settings = settingsR.data
    ? settingsFromRow(settingsR.data, { baseCurrency: extras.baseCurrency, secondaryCurrency: secondary })
    : {
        baseCurrency: extras.baseCurrency,
        secondaryCurrency: secondary,
        showSecondaryCurrency: false,
        theme: 'dark' as const,
        language: 'en' as const,
        showCentsInDashboard: true,
        monthStartDay: 1,
        budgetEntryMode: 'amount' as const,
        enableAI: true,
        aiProvider: 'gemini' as const,
        noIncomeDeclared: false,
        showAllCurrenciesInForms: true,
        twoFactorEmailEnabled: false,
        legacyOnboardingMigratedAt: null,
        dashboardLayout: 'standard' as const,
        tutorialsCompleted: [] as string[],
        tutorialCurrentStep: null as string | null,
        smsTrackingEnabled: false,
      }

  const plans = (planR.data ?? []).map((plan) =>
    assembleBudgetPlan({
      plan,
      categories: catR.data ?? [],
      subcategories: subcatR.data ?? [],
    })
  )

  return {
    profile,
    settings,
    financialGoalsNotes: extras.financialGoalsNotes,
    activeBudgetPlanId: extras.activeBudgetPlanId,
    paymentMethods: (pmR.data ?? []).map(paymentMethodFromRow),
    incomeSources: (incomeR.data ?? []).map(incomeSourceFromRow),
    incomeEvents: (incomeEvtR.data ?? []).map(incomeEventFromRow),
    expenses: (expenseR.data ?? []).map(expenseFromRow),
    receipts: (receiptR.data ?? []).map(receiptFromRow),
    recurringExpenses: (recExpR.data ?? []).map(recurringExpenseFromRow),
    subscriptions: (subR.data ?? []).map(subscriptionFromRow),
    debts: (debtR.data ?? []).map(debtFromRow),
    debtPayments: (debtPayR.data ?? []).map(debtPaymentFromRow),
    recurringDebtPayments: (recDebtR.data ?? []).map(recurringDebtPaymentFromRow),
    savingsAccounts: (saR.data ?? []).map(savingsAccountFromRow),
    savingsHoldings: (shR.data ?? []).map(savingsHoldingFromRow),
    savingsTransactions: (stR.data ?? []).map(savingsTransactionFromRow),
    recurringSavingsDeposits: (rsdR.data ?? []).map(recurringSavingsDepositFromRow),
    goals: (goalR.data ?? []).map(goalFromRow),
    budgetPlans: plans,
  }
}
