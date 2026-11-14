import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent, PaymentMethod } from '@/lib/store/types'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { withAlias } from '@/lib/accounts/identity/accountRef'
import type { DetectedAccount } from '@/hooks/usePaymentMethodDetector'

/**
 * Provisional accounts: created by the server from a bank message that gave bank, digits and currency
 * (src/lib/sms/accountPlacement.ts). They carry history at once but no balance, and wait here for one of three
 * answers: keep (confirm), merge into an account the user already has, or not mine.
 */

type Ledger = { expenses: readonly Expense[]; incomeEvents: readonly IncomeEvent[] }

const PREFIX = 'prov:'
export const provisionalKey = (id: string): string => `${PREFIX}${id}`
export const provisionalIdOf = (key: string): string | null => (key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null)

/** Ledger rows that sit on this account. */
export function rowsOn(ledger: Ledger, id: string): { expenseIds: string[]; toExpenseIds: string[]; incomeIds: string[] } {
  return {
    expenseIds: ledger.expenses.filter((e) => e.paymentMethodId === id).map((e) => e.id),
    toExpenseIds: ledger.expenses.filter((e) => e.toPaymentMethodId === id).map((e) => e.id),
    incomeIds: ledger.incomeEvents.filter((e) => e.paymentMethodId === id).map((e) => e.id),
  }
}

/** Provisional accounts in the shape the detected-accounts sheet lists, so they share its row, count and surfaces. */
export function provisionalAsDetected(methods: readonly PaymentMethod[], ledger: Ledger): DetectedAccount[] {
  return methods
    .filter((m) => m.provisional && !m.closedAt && m.last4)
    .map((m) => {
      const rows = rowsOn(ledger, m.id)
      return {
        key: provisionalKey(m.id),
        currency: String(m.currency),
        provider: decomposePaymentMethodName(m.name, m.last4).provider || null,
        last4: m.last4 as string,
        type: m.type,
        count: rows.expenseIds.length + rows.toExpenseIds.length + rows.incomeIds.length,
      }
    })
}

export interface MergePlan {
  rows: ReturnType<typeof rowsOn>
  /** What the target learns: the provisional account's digits become its number or an alias. Empty when it already answers to them. */
  targetPatch: Partial<Pick<PaymentMethod, 'last4' | 'last4Aliases'>>
  /** The target's number fields before the merge, for Undo. */
  targetBefore: Pick<PaymentMethod, 'last4' | 'last4Aliases'>
  /** The provisional account as it was, for Undo. */
  removed: PaymentMethod
}

/** Pure plan for "this is the same account as that one": every row moves to the target and nothing is lost. */
export function planMerge(methods: readonly PaymentMethod[], ledger: Ledger, id: string, targetId: string): MergePlan | null {
  const removed = methods.find((m) => m.id === id)
  const target = methods.find((m) => m.id === targetId)
  if (!removed?.provisional || !target || target.id === id || target.provisional) return null
  return {
    rows: rowsOn(ledger, id),
    targetPatch: removed.last4 ? withAlias(target, removed.last4) : {},
    targetBefore: { last4: target.last4, last4Aliases: target.last4Aliases },
    removed,
  }
}

const store = () => useFinanceStore.getState()

function repoint(rows: MergePlan['rows'], to: string): void {
  const s = store()
  for (const id of rows.expenseIds) s.updateExpense(id, { paymentMethodId: to })
  for (const id of rows.toExpenseIds) s.updateExpense(id, { toPaymentMethodId: to })
  for (const id of rows.incomeIds) s.updateIncomeEvent(id, { paymentMethodId: to })
}

/** Keep: the account becomes an ordinary one (the user can then rename it and set its balance). Returns Undo. */
export function confirmProvisional(id: string): () => void {
  store().updatePaymentMethod(id, { provisional: false })
  return () => store().updatePaymentMethod(id, { provisional: true })
}

/** Not mine: it stays as an excluded account, so its messages stop counting and it is not re-created. Returns Undo. */
export function rejectProvisional(id: string): () => void {
  store().updatePaymentMethod(id, { provisional: false, excluded: true })
  return () => store().updatePaymentMethod(id, { provisional: true, excluded: false })
}

/**
 * Merge into `targetId`: history is re-pointed, the target learns the digits (so future messages land on it) and the
 * provisional account is removed. Returns Undo, which restores the account and moves the same rows back; null when
 * the pair cannot be merged.
 */
export function mergeProvisional(id: string, targetId: string): (() => void) | null {
  const s = store()
  const plan = planMerge(s.paymentMethods, s, id, targetId)
  if (!plan) return null
  repoint(plan.rows, targetId)
  if (Object.keys(plan.targetPatch).length > 0) s.updatePaymentMethod(targetId, plan.targetPatch)
  s.deletePaymentMethod(id)
  return () => {
    const { id: _gone, ...rest } = plan.removed
    void _gone
    if (Object.keys(plan.targetPatch).length > 0) store().updatePaymentMethod(targetId, plan.targetBefore)
    repoint(plan.rows, store().addPaymentMethod(rest))
  }
}
