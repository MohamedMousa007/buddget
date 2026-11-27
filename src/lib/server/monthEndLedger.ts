import type { createServiceRoleClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import type { LedgerInput } from '@/lib/accounts/balance'
import type { Goal } from '@/lib/store/types'
import { accountAdjustmentFromRow } from '@/lib/supabase/remote/mappers/accountAdjustmentMapper'
import { debtFromRow } from '@/lib/supabase/remote/mappers/debtMapper'
import { debtPaymentFromRow } from '@/lib/supabase/remote/mappers/debtPaymentMapper'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { incomeEventFromRow } from '@/lib/supabase/remote/mappers/incomeEventMapper'
import { paymentMethodFromRow } from '@/lib/supabase/remote/mappers/paymentMethodMapper'
import { savingsAccountFromRow } from '@/lib/supabase/remote/mappers/savingsAccountMapper'
import { savingsTransactionFromRow } from '@/lib/supabase/remote/mappers/savingsTransactionMapper'

type Service = ReturnType<typeof createServiceRoleClient>
type Tables = Database['public']['Tables']
export type SummaryRow = Tables['savings_month_summary']['Row']

/** Live FX as the store keys it (`USD_EGP`); empty when the feed is down (callers then write nothing). */
export async function fetchRates(): Promise<Record<string, number>> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) })
    const d = (await r.json()) as { rates?: Record<string, number> }
    const out: Record<string, number> = {}
    for (const [c, v] of Object.entries(d.rates ?? {})) if (typeof v === 'number') out[`USD_${c}`] = v
    return out
  } catch {
    return {}
  }
}

export const must = <T extends { error: { message: string } | null }>(r: T, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r
}

export interface DueUser {
  userId: string
  monthStartDay: number
  timezone: string
  language: string | null
  today: string
  latestStart: string | null
  latestEnd: string | null
  due: boolean
  /** The newest ended standard cycle, when the user has no month-end row yet. */
  dueStart: string | null
  dueEnd: string | null
}

/** month_end_due_users (0362): due users after `after` (keyset), or one user's state with `user`. */
export async function dueUsers(service: Service, o: { after?: string | null; limit?: number; user?: string }): Promise<{ users: DueUser[]; nextAfter: string | null }> {
  const { data } = must(await service.rpc('month_end_due_users', { p_after: o.after ?? undefined, p_limit: o.limit ?? 25, p_user: o.user }), 'due users')
  const body = (data ?? {}) as { users?: Record<string, unknown>[]; next_after?: string | null }
  const users = (body.users ?? []).map((u) => ({
    userId: u.user_id as string,
    monthStartDay: Number(u.month_start_day) || 1,
    timezone: (u.timezone as string) || 'Africa/Cairo',
    language: (u.language as string | null) ?? null,
    today: u.today as string,
    latestStart: (u.latest_start as string | null) ?? null,
    latestEnd: (u.latest_end as string | null) ?? null,
    due: u.due === true,
    dueStart: (u.due_start as string | null) ?? null,
    dueEnd: (u.due_end as string | null) ?? null,
  }))
  return { users, nextAfter: body.next_after ?? null }
}

export interface MonthEndLedger {
  base: string
  profileCreatedAt: string | null
  savingsSplit: unknown
  ledger: Omit<LedgerInput, 'convert'>
  goals: Goal[]
  summaries: SummaryRow[]
  /** A list hit the RPC's row cap: the figures would be short, so nothing is proposed or applied. */
  truncated: boolean
}

/** One round trip (month_end_ledger, 0362): everything the month-end of the cycle starting `cycleStart` reads. */
export async function loadMonthEndLedger(service: Service, userId: string, cycleStart: string): Promise<MonthEndLedger> {
  const { data } = must(await service.rpc('month_end_ledger', { p_user: userId, p_cycle_start: cycleStart }), 'month end ledger')
  const r = (data ?? {}) as Record<string, unknown>
  const list = <K extends keyof Tables>(key: string) => ((r[key] as Tables[K]['Row'][] | undefined) ?? [])
  const profile = (r.profile ?? {}) as { base_currency?: string; created_at?: string; savings_split?: unknown }
  return {
    base: profile.base_currency ?? 'EGP',
    profileCreatedAt: profile.created_at ?? null,
    savingsSplit: profile.savings_split ?? [],
    ledger: {
      paymentMethods: list<'payment_methods'>('payment_methods').map(paymentMethodFromRow),
      // A partial refund (refunded_amount, no refunded_at) is a server write: updated_at is when it arrived.
      expenses: list<'expenses'>('expenses').map((row) => ({ ...expenseFromRow(row), ...(row.refunded_amount && !row.refunded_at ? { updatedAt: row.updated_at } : {}) })),
      incomeEvents: list<'income_events'>('income_events').map(incomeEventFromRow),
      debtPayments: list<'debt_payments'>('debt_payments').map(debtPaymentFromRow),
      debts: list<'debts'>('debts').map(debtFromRow),
      savingsTransactions: list<'savings_transactions'>('savings_transactions').map(savingsTransactionFromRow),
      savingsAccounts: list<'savings_accounts'>('savings_accounts').map(savingsAccountFromRow),
      adjustments: list<'account_adjustments'>('account_adjustments').map(accountAdjustmentFromRow),
    },
    goals: list<'goals'>('goals').map(goalFromRow),
    summaries: list<'savings_month_summary'>('summaries'),
    truncated: r.truncated === true,
  }
}
