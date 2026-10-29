import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryFromRow, memoryToRow } from '@/lib/supabase/remote/mappers/buddgyMemoryMapper'
import { activationFromRow, activationToRow } from '@/lib/supabase/remote/mappers/budgetActivationMapper'
import type { Database } from '@/lib/supabase/database.types'
import type { Snapshot } from './snapshot'
import type { HasId } from './types'
import { diffLists, diffSingleton } from './diff'
import { profileToRow, profileFromRow } from './mappers/profileMapper'
import { settingsToRow, settingsFromRow } from './mappers/settingsMapper'
import { paymentMethodToRow, paymentMethodFromRow } from './mappers/paymentMethodMapper'
import { accountAdjustmentToRow, accountAdjustmentFromRow } from './mappers/accountAdjustmentMapper'
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
import { investmentHoldingToRow, investmentHoldingFromRow } from './mappers/investmentHoldingMapper'
import { savingsTransactionToRow, savingsTransactionFromRow } from './mappers/savingsTransactionMapper'
import { recurringSavingsDepositToRow, recurringSavingsDepositFromRow } from './mappers/recurringSavingsDepositMapper'
import { goalToRow, goalFromRow } from './mappers/goalMapper'
import {
  budgetPlanToRow,
  budgetCategoryToRow,
  budgetSubcategoryToRow,
  assembleBudgetPlan,
} from './mappers/budgetPlanMapper'
import type { AppSettings, Currency, SavingsAccount } from '@/lib/store/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

type Client = SupabaseClient<Database>
type TableName = keyof Database['public']['Tables']

export interface FlushResult {
  anyError: boolean
  errors: string[]
  writes: number
  /** Local payday events dropped because another device's live row won; the store must drop them too. */
  adoptedPaydays?: string[]
}


/** Settings for an account that has no `user_settings` row yet. */
export function defaultServerSettings(baseCurrency: Currency, secondaryCurrency: Currency | null): AppSettings {
  return {
    baseCurrency,
    secondaryCurrency,
    showSecondaryCurrency: false,
    theme: 'dark',
    language: 'en',
    showCentsInDashboard: true,
    monthStartDay: 1,
    budgetEntryMode: 'amount',
    enableAI: true,
    aiProvider: 'gemini',
    noIncomeDeclared: false,
    showAllCurrenciesInForms: true,
    twoFactorEmailEnabled: false,
    legacyOnboardingMigratedAt: null,
    dashboardLayout: 'standard',
    tutorialsCompleted: [],
    tutorialCurrentStep: null,
    smsTrackingEnabled: false,
    subDueReminders: true,
    subPriceAlerts: true,
    goalProgressAlerts: true,
    goalAlerts: true,
  }
}

const PER_ROW_RETRY_CODES = new Set(['23505', '23514', '23503'])

type PgError = { message: string; code?: string } | null
type Writes = Array<() => Promise<unknown>>

class OpRunner {
  errors: string[] = []
  adopted: string[] = []
  writes = 0
  private ops: Writes = []
  private removals: Writes = []

  constructor(private client: Client) {}

  private from(table: TableName) {
    return this.client.from(table) as never as {
      upsert: (r: unknown) => Promise<{ error: PgError }>
      update: (patch: unknown) => { eq: (col: string, v: string) => Promise<{ error: PgError }> }
      select: (cols: string) => {
        eq: (col: string, v: string) => {
          eq: (col: string, v: string) => {
            is: (col: string, v: null) => { maybeSingle: () => Promise<{ data: { id: string; updated_at: string } | null; error: PgError }> }
          }
        }
      }
    }
  }

  /**
   * Upsert a batch of rows to a table. A 23505 (unique), 23514 (check) or 23503 (foreign key) violation must
   * not poison the whole batch: the rows are retried one by one, a duplicate payday event adopts the live row,
   * and only the rows that still fail are reported.
   */
  upsert<T extends TableName>(
    table: T,
    rows: readonly Database['public']['Tables'][T]['Insert'][],
    label: string,
    withRequired?: (row: Database['public']['Tables'][T]['Insert']) => Database['public']['Tables'][T]['Insert']
  ) {
    if (rows.length === 0) return
    this.ops.push(async () => {
      const res = await this.from(table).upsert(rows)
      this.writes++
      if (!res.error) return
      if (!PER_ROW_RETRY_CODES.has(res.error.code ?? '') && !(withRequired && res.error.code === '23502')) {
        this.errors.push(`${label}: ${res.error.message}`)
        return
      }
      for (const row of rows) {
        let one = await this.from(table).upsert([row])
        if (one.error?.code === '23502' && withRequired) one = await this.from(table).upsert([withRequired(row)])
        if (!one.error) continue
        if (one.error.code === '23505' && table === 'income_events' && (await this.adoptLivePayday(row as Record<string, unknown>))) continue
        this.errors.push(`${label}: ${one.error.message}`)
      }
    })
  }

  /** Another device already wrote this (template, payday): keep its row id, carry our newer edit onto it. */
  private async adoptLivePayday(row: Record<string, unknown>): Promise<boolean> {
    if (typeof row.template_id !== 'string' || typeof row.occurrence_date !== 'string') return false
    const live = await this.from('income_events')
      .select('id, updated_at')
      .eq('template_id', row.template_id)
      .eq('occurrence_date', row.occurrence_date)
      .is('deleted_at', null)
      .maybeSingle()
    if (live.error || !live.data) return false
    if (live.data.id === row.id) return false
    this.adopted.push(String(row.id))
    if (String(row.updated_at ?? '') > live.data.updated_at) {
      const { id: _id, user_id: _user, created_at: _created, ...patch } = row
      const upd = await this.from('income_events').update(patch).eq('id', live.data.id)
      if (upd.error) return false
    }
    return true
  }

  delete(table: TableName, ids: readonly string[], label: string) {
    if (ids.length === 0) return
    this.removals.push(() =>
      (this.client.from(table) as never as {
        delete: () => { in: (col: string, vals: readonly string[]) => Promise<{ error: { message: string } | null }> }
      })
        .delete()
        .in('id', ids)
        .then((res) => {
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
    this.removals.push(() =>
      (this.client.from(table) as never as {
        update: (patch: { deleted_at: string }) => {
          in: (col: string, vals: readonly string[]) => Promise<{ error: { message: string } | null }>
        }
      })
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
        .then((res) => {
        this.writes++
        if (res.error) this.errors.push(`${label}: ${res.error.message}`)
      })
    )
  }

  /** Tombstones and deletes land first so a removed row frees its unique key for a same-flush replacement. */
  async drain(): Promise<FlushResult> {
    await Promise.all(this.removals.map((run) => run()))
    await Promise.all(this.ops.map((run) => run()))
    return { anyError: this.errors.length > 0, errors: this.errors, writes: this.writes, adoptedPaydays: this.adopted }
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
  // An insert clears any tombstone left by an earlier delete of the same id, so undoing a delete
  // (re-adding the row) comes back live. Plain updates leave `deleted_at` alone: an edit made
  // offline must not resurrect a row another device deleted.
  const revived = diff.inserts.map((x) => ({ ...toRow(x, userId), deleted_at: null }) as Database['public']['Tables'][TN]['Insert'])
  const writes = [...revived, ...diff.updates.map((x) => toRow(x, userId))]
  runner.upsert(table, writes, `${String(table)}.upsert`)
  // User-owned tables soft-delete: stamp `deleted_at = now()` so the
  // deletion is reconcilable across devices. Hydrate filters
  // `deleted_at IS NULL` so the UI still treats the row as gone.
  runner.tombstone(table, diff.deletes, `${String(table)}.tombstone`)
}

/**
 * W7: the server also moves pocket balances (month-carry, goal funding), so a pocket edit that does not
 * change the balance (rename, colour, target) must not send the device's possibly stale absolute
 * `current_balance`. Those rows go in their own balance-less batch (never mixed with full rows).
 */
function emitSavingsAccounts(
  runner: OpRunner,
  next: readonly SavingsAccount[],
  prev: readonly SavingsAccount[],
  userId: string
) {
  const diff = diffLists(next, prev)
  const prevById = new Map(prev.map((a) => [a.id, a]))
  const balanceKept = (a: SavingsAccount) => prevById.get(a.id)?.currentBalance === a.currentBalance
  const inserts = diff.inserts.map((x) => ({ ...savingsAccountToRow(x, userId), deleted_at: null }))
  const full = diff.updates.filter((a) => !balanceKept(a)).map((x) => savingsAccountToRow(x, userId))
  const metaOnly = diff.updates.filter(balanceKept).map((x) => {
    const { current_balance: _balance, ...row } = savingsAccountToRow(x, userId)
    return row
  })
  runner.upsert('savings_accounts', [...inserts, ...full], 'savings_accounts.upsert')
  // A balance-less row whose server row was hard-deleted becomes an INSERT with a NULL balance (23502): resend it with its balance.
  const nextById = new Map(next.map((a) => [a.id, a]))
  runner.upsert('savings_accounts', metaOnly as never, 'savings_accounts.upsert', (row) => ({
    ...row,
    current_balance: nextById.get(String((row as { id: string }).id))?.currentBalance,
  }) as never)
  runner.tombstone('savings_accounts', diff.deletes, 'savings_accounts.tombstone')
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
  // Writes drain tier by tier so a parent row commits before any child that references it (FK order).
  // Link-column FKs (Q9): income_sources need debts + pockets (level1), income_events need income_sources (level2),
  // and the profile points at the active plan (roots) and the carry pocket (level1), so it goes last.
  const [roots, level1, level2, level3] = [new OpRunner(client), new OpRunner(client), new OpRunner(client), new OpRunner(client)]

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
    level3.upsert('profiles', [profileToRow(next.profile, profileExtras, userId)], 'profiles.upsert')
  }
  if (diffSingleton(next.settings, prev.settings) != null) {
    roots.upsert('user_settings', [settingsToRow(next.settings, userId)], 'user_settings.upsert')
  }

  // Array slices — the built-in `pm_default_cash` sentinel is kept in-store
  // for a frictionless add-expense UX but never synced: its non-UUID id
  // would be rejected by the `payment_methods.id uuid` column, and FKs that
  // pointed at it are null-emitted by the expense / debt-payment mappers.
  const nextPayments = next.paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID)
  const prevPayments = prev.paymentMethods.filter((pm) => pm.id !== DEFAULT_CASH_ID)
  emitList(roots, 'payment_methods', nextPayments, prevPayments, paymentMethodToRow, userId)
  emitList(level2, 'income_sources', next.incomeSources, prev.incomeSources, incomeSourceToRow, userId)
  emitList(level3, 'income_events', next.incomeEvents, prev.incomeEvents, incomeEventToRow, userId)
  emitList(level1, 'receipts', next.receipts, prev.receipts, receiptToRow, userId)
  emitList(level3, 'expenses', next.expenses, prev.expenses, expenseToRow, userId)
  emitList(level2, 'recurring_expenses', next.recurringExpenses, prev.recurringExpenses, recurringExpenseToRow, userId)
  emitList(level1, 'subscriptions', next.subscriptions, prev.subscriptions, subscriptionToRow, userId)
  emitList(level1, 'debts', next.debts, prev.debts, debtToRow, userId)
  emitList(level2, 'debt_payments', next.debtPayments, prev.debtPayments, debtPaymentToRow, userId)
  emitList(level2, 'recurring_debt_payments', next.recurringDebtPayments, prev.recurringDebtPayments, recurringDebtPaymentToRow, userId)
  emitSavingsAccounts(level1, next.savingsAccounts, prev.savingsAccounts, userId)
  emitList(level2, 'savings_holdings', next.investmentHoldings, prev.investmentHoldings, investmentHoldingToRow, userId)
  emitList(level2, 'savings_transactions', next.savingsTransactions, prev.savingsTransactions, savingsTransactionToRow, userId)
  emitList(level2, 'recurring_savings_deposits', next.recurringSavingsDeposits, prev.recurringSavingsDeposits, recurringSavingsDepositToRow, userId)
  emitList(roots, 'goals', next.goals, prev.goals, goalToRow, userId)
  emitList(level1, 'account_adjustments', next.accountAdjustments, prev.accountAdjustments, accountAdjustmentToRow, userId)

  flushBudgetPlans([roots, level1, level2], userId, prev, next, next.settings.baseCurrency)
  emitList(level1, 'buddgy_memories', next.buddgyMemories, prev.buddgyMemories, memoryToRow, userId)

  const result = mergeResults([await roots.drain(), await level1.drain(), await level2.drain(), await level3.drain()])
  // Activations reference plans (FK), so they commit only after the plan rows above are in.
  // A re-switch in the same cycle replaces the row, and the one-live-row-per-cycle index would reject
  // the new row while the old one is still live, so the tombstone lands first.
  const activationDiff = diffLists(next.budgetPlanActivations, prev.budgetPlanActivations)
  const staleRunner = new OpRunner(client)
  staleRunner.tombstone('budget_plan_activations', activationDiff.deletes, 'budget_plan_activations.tombstone')
  const staleResult = await staleRunner.drain()
  const freshRunner = new OpRunner(client)
  freshRunner.upsert(
    'budget_plan_activations',
    [...activationDiff.inserts, ...activationDiff.updates].map((a) => activationToRow(a, userId)),
    'budget_plan_activations.upsert'
  )
  const freshResult = await freshRunner.drain()
  return mergeResults([result, staleResult, freshResult])
}

function mergeResults(results: FlushResult[]): FlushResult {
  return {
    anyError: results.some((r) => r.anyError),
    errors: results.flatMap((r) => r.errors),
    writes: results.reduce((n, r) => n + r.writes, 0),
    adoptedPaydays: results.flatMap((r) => r.adoptedPaydays ?? []),
  }
}

function flushBudgetPlans([plans, categories, subcategories]: [OpRunner, OpRunner, OpRunner], userId: string, prev: Snapshot, next: Snapshot, baseCurrency: Currency) {
  const planDiff = diffLists(next.budgetPlans, prev.budgetPlans)
  const planRows = [...planDiff.inserts, ...planDiff.updates].map((p) => budgetPlanToRow(p, userId))
  plans.upsert('budget_plans', planRows, 'budget_plans.upsert')
  plans.tombstone('budget_plans', planDiff.deletes, 'budget_plans.tombstone')

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
  categories.upsert('budget_categories', catRows, 'budget_categories.upsert')
  categories.tombstone('budget_categories', catDiff.deletes, 'budget_categories.tombstone')

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
  subcategories.upsert('budget_subcategories', subRows, 'budget_subcategories.upsert')
  subcategories.tombstone('budget_subcategories', subDiff.deletes, 'budget_subcategories.tombstone')
}

const PAGE_SIZE = 1000

type PageResult = { data: unknown[] | null; error: { message: string } | null }

function throwOnError<T extends { error: { message: string } | null }>(res: T, label: string): T {
  if (res.error) throw new Error(`pull ${label}: ${res.error.message}`)
  return res
}

type KeysetQuery = PromiseLike<PageResult> & {
  gt: (c: string, v: string) => KeysetQuery
}

/** Every live row of a user-owned table, keyset-paged on id past PostgREST's row cap. A failed query throws instead of reading as "no rows". */
async function fetchLive<TN extends TableName>(client: Client, table: TN, userId: string): Promise<Database['public']['Tables'][TN]['Row'][]> {
  const rows: Record<string, unknown>[] = []
  let after: string | null = null
  for (;;) {
    const base = (client.from(table) as never as {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          is: (c: string, v: null) => {
            order: (c: string) => { limit: (n: number) => KeysetQuery }
          }
        }
      }
    })
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('id')
      .limit(PAGE_SIZE)
    const res = (await (after === null ? base : base.gt('id', after))) as PageResult
    throwOnError(res, String(table))
    const page = (res.data ?? []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows as Database['public']['Tables'][TN]['Row'][]
    after = String(page[page.length - 1].id)
  }
}

/**
 * Minimal "always needed" hydration: profiles + user_settings + payment_methods.
 * All per-page hooks add the heavier domains (expenses, debts, etc.) on demand.
 *
 * Returns partial snapshot (array slices default to []) — use as the baseline for
 * the sync-layer diff; per-page hooks can update Zustand independently.
 */
export async function pullCore(client: Client, userId: string): Promise<Snapshot | null> {
  const [profileR, settingsR, pmRows] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    fetchLive(client, 'payment_methods', userId),
  ])
  throwOnError(profileR, 'profiles')
  throwOnError(settingsR, 'user_settings')

  if (!profileR.data) return null

  const { profile, extras } = profileFromRow(profileR.data)
  const secondary = (profileR.data.secondary_currency ?? null) as Currency | null
  const settings = settingsR.data
    ? settingsFromRow(settingsR.data, { baseCurrency: extras.baseCurrency, secondaryCurrency: secondary })
    : defaultServerSettings(extras.baseCurrency, secondary)

  return {
    profile,
    settings,
    financialGoalsNotes: extras.financialGoalsNotes,
    activeBudgetPlanId: extras.activeBudgetPlanId,
    paymentMethods: pmRows.map(paymentMethodFromRow),
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
    investmentHoldings: [],
    savingsTransactions: [],
    recurringSavingsDeposits: [],
    goals: [],
    budgetPlans: [],
    budgetPlanActivations: [],
    buddgyMemories: [],
    accountAdjustments: [],
  }
}

/**
 * Fetch every user-owned table in parallel and assemble a Snapshot.
 * Returns null if the user has no `profiles` row yet (unauthenticated race).
 */
export async function pullAll(client: Client, userId: string): Promise<Snapshot | null> {
  const [
    profileR, settingsR,
    pmRows, incomeRows, incomeEvtRows, expenseRows, receiptRows, recExpRows, subRows, debtRows, debtPayRows, recDebtRows, saRows, shRows, stRows, rsdRows, goalRows, planRows, catRows, subcatRows, activationRows, memoryRows, adjRows,
  ] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    fetchLive(client, 'payment_methods', userId),
    fetchLive(client, 'income_sources', userId),
    fetchLive(client, 'income_events', userId),
    fetchLive(client, 'expenses', userId),
    fetchLive(client, 'receipts', userId),
    fetchLive(client, 'recurring_expenses', userId),
    fetchLive(client, 'subscriptions', userId),
    fetchLive(client, 'debts', userId),
    fetchLive(client, 'debt_payments', userId),
    fetchLive(client, 'recurring_debt_payments', userId),
    fetchLive(client, 'savings_accounts', userId),
    fetchLive(client, 'savings_holdings', userId),
    fetchLive(client, 'savings_transactions', userId),
    fetchLive(client, 'recurring_savings_deposits', userId),
    fetchLive(client, 'goals', userId),
    fetchLive(client, 'budget_plans', userId),
    fetchLive(client, 'budget_categories', userId),
    fetchLive(client, 'budget_subcategories', userId),
    fetchLive(client, 'budget_plan_activations', userId),
    fetchLive(client, 'buddgy_memories', userId),
    fetchLive(client, 'account_adjustments', userId),
  ])
  throwOnError(profileR, 'profiles')
  throwOnError(settingsR, 'user_settings')

  if (!profileR.data) return null

  const { profile, extras } = profileFromRow(profileR.data)
  const secondary = (profileR.data.secondary_currency ?? null) as Currency | null
  const settings = settingsR.data
    ? settingsFromRow(settingsR.data, { baseCurrency: extras.baseCurrency, secondaryCurrency: secondary })
    : defaultServerSettings(extras.baseCurrency, secondary)

  const plans = planRows.map((plan) =>
    assembleBudgetPlan({
      plan,
      categories: catRows,
      subcategories: subcatRows,
    })
  )

  return {
    profile,
    settings,
    financialGoalsNotes: extras.financialGoalsNotes,
    activeBudgetPlanId: extras.activeBudgetPlanId,
    paymentMethods: pmRows.map(paymentMethodFromRow),
    incomeSources: incomeRows.map(incomeSourceFromRow),
    incomeEvents: incomeEvtRows.map(incomeEventFromRow),
    expenses: expenseRows.map(expenseFromRow),
    receipts: receiptRows.map(receiptFromRow),
    recurringExpenses: recExpRows.map(recurringExpenseFromRow),
    subscriptions: subRows.map(subscriptionFromRow),
    debts: debtRows.map(debtFromRow),
    debtPayments: debtPayRows.map(debtPaymentFromRow),
    recurringDebtPayments: recDebtRows.map(recurringDebtPaymentFromRow),
    savingsAccounts: saRows.map(savingsAccountFromRow),
    investmentHoldings: shRows.map(investmentHoldingFromRow),
    savingsTransactions: stRows.map(savingsTransactionFromRow),
    recurringSavingsDeposits: rsdRows.map(recurringSavingsDepositFromRow),
    goals: goalRows.map(goalFromRow),
    budgetPlans: plans,
    budgetPlanActivations: activationRows.map(activationFromRow),
    buddgyMemories: memoryRows.map(memoryFromRow),
    accountAdjustments: adjRows.map(accountAdjustmentFromRow),
  }
}
