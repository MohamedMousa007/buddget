'use client'

import { useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useBudgetDeckCopy } from '@/components/features/budget/useDeckCopy'
import { useBudgetPageCopy } from '@/components/features/budget/usePageCopy'
import { cycleKeyOf } from '@/lib/budget/activations'
import { duplicatePlanCategories } from '@/lib/budget/duplicatePlan'

const newId = () => crypto.randomUUID()

/** Plan-level actions shared by the Budget page and the plan history screen. */
export function usePlanActions() {
  const page = useBudgetPageCopy()
  const d = useBudgetDeckCopy()
  const confirm = useConfirm()
  const toast = useActionToast()
  const store = useFinanceStore

  const duplicate = useCallback(
    (id: string) => {
      const s = store.getState()
      const source = s.budgetPlans.find((p) => p.id === id)
      if (!source) return
      // Created as a draft so the copy does not take over; ready once its lines are in.
      const copy = s.addBudgetPlan(page.planNames.copyOf(source.name), { status: 'draft', origin: 'clone', intent: source.intent })
      s.updateBudgetPlan(copy, { status: 'ready', categories: duplicatePlanCategories(source, newId) })
      toast(d.deck.duplicated(page.planNames.copyOf(source.name)))
      return copy
    },
    [d, page, store, toast],
  )

  const createBlank = useCallback(() => {
    const s = store.getState()
    const id = s.addBudgetPlan(page.planNames.fresh, { status: 'draft', origin: 'manual' })
    s.updateBudgetPlan(id, { status: 'ready' })
  }, [page, store])

  /** A draft the manual builder fills in; it stays out of the way until the user finishes it. */
  const createDraft = useCallback(
    () => store.getState().addBudgetPlan(page.planNames.fresh, { status: 'draft', origin: 'manual' }),
    [page, store],
  )

  const rename = useCallback((id: string, name: string) => store.getState().updateBudgetPlan(id, { name }), [store])

  const remove = useCallback(
    async (id: string) => {
      const plan = store.getState().budgetPlans.find((p) => p.id === id)
      if (!plan) return
      const ok = await confirm({ title: d.deck.deleteTitle(plan.name), body: d.deck.deleteBody, confirmLabel: d.deck.deleteConfirm, destructive: true })
      if (ok) store.getState().deleteBudgetPlan(id)
    },
    [confirm, d, store],
  )

  const activate = useCallback(
    (id: string) => {
      const s = store.getState()
      const plan = s.budgetPlans.find((p) => p.id === id)
      if (!plan) return
      const undo = s.activateBudgetPlan(id, cycleKeyOf(new Date(), s.settings.monthStartDay))
      toast(d.activate.done(plan.name), { undoLabel: d.activate.undo, undo: () => store.getState().restoreBudgetActivation(undo) })
    },
    [d, store, toast],
  )

  return { duplicate, createBlank, createDraft, rename, remove, activate }
}
