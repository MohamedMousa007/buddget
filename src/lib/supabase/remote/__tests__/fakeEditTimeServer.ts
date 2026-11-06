import type { MappedDelta } from '@/lib/supabase/remote/delta'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import type { Expense } from '@/lib/store/types'

/** Postgres renders timestamptz with an explicit offset; the device writes `...Z`. The merge relies on telling them apart. */
export const pgTime = (ms: number) => new Date(ms).toISOString().replace('Z', '+00:00')

const TOLERANCE_MS = 3000

export type Row = Record<string, unknown> & { id: string; amount: number; edited_at: string; updated_at: string; deleted_at: string | null }

/**
 * The `expenses` table with migration 0241 behind it: `a0_stamp_insert` (updated_at = now(), edited_at clamped to now()),
 * `a0_reject_stale_write` (edit-time guard, stale revive keeps content) and `set_updated_at`, plus the 2-minute delta window.
 */
export function fakeEditTimeServer(clock: { now: number }) {
  const rows = new Map<string, Row>()
  const written: Row[][] = []

  const upsertOne = (incoming: Record<string, unknown> & { id: string }): boolean => {
    const old = rows.get(incoming.id)
    const sentEdit = incoming.edited_at === undefined ? undefined : Date.parse(String(incoming.edited_at))
    if (!old) {
      rows.set(incoming.id, {
        deleted_at: null,
        ...(incoming as object),
        updated_at: pgTime(clock.now),
        edited_at: pgTime(Math.min(sentEdit ?? clock.now, clock.now)),
      } as Row)
      return true
    }
    const oldEdit = Date.parse(old.edited_at)
    const { edited_at: _e, updated_at: _u, ...content } = incoming as Record<string, unknown>
    if (sentEdit === undefined || sentEdit === oldEdit) {
      rows.set(old.id, { ...old, ...content, deleted_at: 'deleted_at' in content ? (content.deleted_at as string | null) : old.deleted_at, updated_at: pgTime(clock.now) } as Row)
      return true
    }
    const edit = Math.min(sentEdit, clock.now)
    if (edit >= oldEdit - TOLERANCE_MS) {
      rows.set(old.id, { ...old, ...content, deleted_at: 'deleted_at' in content ? (content.deleted_at as string | null) : old.deleted_at, edited_at: pgTime(Math.max(edit, oldEdit)), updated_at: pgTime(clock.now) } as Row)
      return true
    }
    if (old.deleted_at && content.deleted_at === null) {
      rows.set(old.id, { ...old, deleted_at: null, updated_at: pgTime(clock.now) })
      return true
    }
    return false
  }

  const client = {
    from: (table: string) => ({
      upsert: (batch: Array<Record<string, unknown> & { id: string }>) => {
        if (table !== 'expenses') return Promise.resolve({ error: null, count: batch.length })
        written.push(batch as Row[])
        return Promise.resolve({ error: null, count: batch.filter(upsertOne).length })
      },
      update: (patch: { deleted_at: string }) => ({
        in: (_c: string, ids: string[]) => {
          for (const id of ids) {
            const r = rows.get(id)
            if (r) rows.set(id, { ...r, deleted_at: patch.deleted_at, updated_at: pgTime(clock.now) })
          }
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }

  /** A server-side writer (SMS pairing, cron): changes content, bumps updated_at, never touches edited_at. */
  const serverWrite = (id: string, content: Record<string, unknown>) => {
    const r = rows.get(id)
    if (r) rows.set(id, { ...r, ...content, updated_at: pgTime(clock.now) })
  }

  /** `sync_pull`: everything touched after the cursor minus two minutes (a first pull returns the live rows). */
  const delta = (since: number | null): MappedDelta => {
    const win = since === null ? null : since - 120_000
    const live: Expense[] = []
    const dead: string[] = []
    for (const r of rows.values()) {
      if (win === null) {
        if (!r.deleted_at) live.push(expenseFromRow(r as never))
      } else if (Date.parse(r.updated_at) > win) {
        if (r.deleted_at) dead.push(r.id)
        else live.push(expenseFromRow(r as never))
      }
    }
    const none = { upserts: [], deletedIds: [] }
    return {
      cursor: pgTime(clock.now), profile: null, settings: null, paymentMethods: none, incomeSources: none, incomeEvents: none,
      expenses: { upserts: live, deletedIds: dead },
      receipts: none, recurringExpenses: none, subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none,
      savingsAccounts: none, investmentHoldings: none, savingsTransactions: none, recurringSavingsDeposits: none, goals: none,
      buddgyMemories: none, accountAdjustments: none, budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [],
      deletedBudgetPlanActivationIds: [], staleBefore: null,
    } as MappedDelta
  }

  return { client, rows, written, delta, serverWrite }
}

export const expenseAt = (id: string, amount: number, editedAtMs: number, description = 'Lunch'): Expense => ({
  id, date: '2026-10-10', description, category: 'Food', amount, currency: 'EGP', amountInBaseCurrency: amount,
  paymentMethodId: '', isRecurring: false, createdAt: new Date(editedAtMs).toISOString(), updatedAt: new Date(editedAtMs).toISOString(),
})
