import { reconcileGoalsForState, useFinanceStore } from '@/lib/store/useFinanceStore'
import { noteRestored } from '@/lib/store/undoWatch'
import type { FinanceStore } from '@/lib/store/types'
import { closeAccount } from './actions'

type Slice = Pick<FinanceStore, 'paymentMethods' | 'debts' | 'debtPayments' | 'recurringDebtPayments'>

/** The rows in `before` that `after` removed or replaced (a closed method, a detached card, a promoted default). */
function changed<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  const now = new Map(after.map((r) => [r.id, r]))
  return before.filter((r) => now.get(r.id) !== r)
}

/**
 * Runs a card delete or an account close and returns an Undo that puts back every row it changed: the method, cards it
 * detached, the default it moved, and a deleted card's own debt rows. Restored rows get a fresh edit time (the server
 * clears a tombstone only for a newer action) and are watched in case the undo still loses to a delete elsewhere.
 * Null when refused: money is still set aside in it (I-14), so nothing changed.
 */
export function removeMethodWithUndo(id: string, mode: 'delete' | 'close'): (() => void) | null {
  const before: Slice = useFinanceStore.getState()
  const goalsBefore = new Map(useFinanceStore.getState().goals.map((g) => [g.id, g.linkedDebtIds]))
  const done = mode === 'close' ? closeAccount(id) : useFinanceStore.getState().deletePaymentMethod(id)
  if (!done) return null
  const after: Slice = useFinanceStore.getState()
  const lost = {
    paymentMethods: changed(before.paymentMethods, after.paymentMethods),
    debts: changed(before.debts, after.debts),
    debtPayments: changed(before.debtPayments, after.debtPayments),
    recurringDebtPayments: changed(before.recurringDebtPayments, after.recurringDebtPayments),
  }
  const droppedDebts = new Set(lost.debts.map((d) => d.id))

  return () => {
    useFinanceStore.setState((s) => {
      const at = new Date().toISOString()
      const back = <T extends { id: string }>(current: readonly T[], rows: readonly T[]): T[] => {
        if (rows.length === 0) return [...current]
        const ids = new Set(rows.map((r) => r.id))
        for (const r of rows) noteRestored(r.id)
        return [...current.filter((r) => !ids.has(r.id)), ...rows.map((r) => ({ ...r, updatedAt: at }))]
      }
      const next = {
        ...s,
        paymentMethods: back(s.paymentMethods, lost.paymentMethods),
        debts: back(s.debts, lost.debts),
        debtPayments: back(s.debtPayments, lost.debtPayments),
        recurringDebtPayments: back(s.recurringDebtPayments, lost.recurringDebtPayments),
        goals: droppedDebts.size === 0 ? s.goals : s.goals.map((g) => {
          const had = (goalsBefore.get(g.id) ?? []).filter((x) => droppedDebts.has(x) && !g.linkedDebtIds.includes(x))
          return had.length ? { ...g, linkedDebtIds: [...g.linkedDebtIds, ...had] } : g
        }),
      }
      return {
        paymentMethods: next.paymentMethods,
        debts: next.debts,
        debtPayments: next.debtPayments,
        recurringDebtPayments: next.recurringDebtPayments,
        goals: reconcileGoalsForState(next),
      }
    })
  }
}
