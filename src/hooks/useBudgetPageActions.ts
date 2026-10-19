'use client'

import { useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useAlert } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useBudgetPageCopy } from '@/components/features/budget/usePageCopy'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { buildPlan, ENGINE_VERSION } from '@/lib/budget/engine'
import { repairDraft } from '@/lib/budget/validate'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { upgradeLegacyLines } from '@/lib/budget/legacyUpgrade'
import { patchInBase } from '@/lib/budget/lineEdit'
import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import type { BudgetPlanCategory } from '@/lib/store/types'
import type { LineView, PlanView } from '@/lib/budget/planView.types'

const newId = () => crypto.randomUUID()

/** Every mutation the Budget page performs, in one place. The page stays presentational. */
export function useBudgetPageActions(view: PlanView | null) {
  const t = useBudgetPageCopy()
  const toast = useActionToast()
  const alert = useAlert()
  const store = useFinanceStore

  const planId = view?.plan.id ?? null

  const createStarterPlan = useCallback(async () => {
    const s = store.getState()
    const facts = buildFactsFromStore(s, new Date())
    if (!(facts.monthlyIncome > 0)) {
      await alert({ title: t.needIncome.title, body: t.needIncome.body, okLabel: t.needIncome.ok })
      return
    }
    const draft = buildPlan(facts)
    const { draft: repaired } = repairDraft(draft, {
      income: draft.income,
      subscriptionsLive: facts.subscriptionsMonthly,
      debtMinimums: Object.fromEntries(facts.debts.map((d) => [d.id, d.minimum])),
      goalMonthly: Object.fromEntries(facts.goals.map((g) => [g.id, g.monthly])),
    })
    const id = s.addBudgetPlan(t.planNames.starter, {
      status: 'ready',
      origin: 'template',
      intent: repaired.intent,
      rationale: { reasons: repaired.reasons, risks: repaired.risks },
      engineVersion: ENGINE_VERSION,
    })
    s.updateBudgetPlan(id, { categories: draftToCategories(repaired, newId, s.settings.baseCurrency) })
    toast(t.starterBuilt)
  }, [alert, store, t, toast])

  const patchLine = useCallback(
    (lineId: string, patch: Partial<BudgetPlanCategory>) => {
      if (planId && view) store.getState().updatePlanCategory(planId, lineId, patchInBase(patch, view.base))
    },
    [planId, store, view],
  )

  const deleteLine = useCallback(
    (lineId: string) => {
      if (planId) store.getState().deletePlanCategory(planId, lineId)
    },
    [planId, store],
  )

  const addLine = useCallback(
    (line: Omit<BudgetPlanCategory, 'id' | 'subcategories'>) => {
      if (planId) store.getState().addPlanCategory(planId, line)
    },
    [planId, store],
  )

  const syncLive = useCallback(
    (line: LineView) => {
      if (line.liveAmount != null) patchLine(line.line.id, { amount: Math.round(line.liveAmount * 100) / 100 })
    },
    [patchLine],
  )

  const syncAllLive = useCallback(() => {
    if (!view) return
    for (const block of Object.values(view.blocks)) for (const l of block.lines) syncLive(l)
  }, [syncLive, view])

  const moveFreeToBuffer = useCallback(() => {
    if (!view || !planId || view.free <= 0) return
    const buffer = view.blocks.grow.lines.find((l) => l.line.name.trim().toLowerCase() === 'buffer')
    const rates = store.getState().exchangeRates
    const cur = buffer?.line.currency ?? view.base
    // Only a plain line in its own currency can be topped up in place; otherwise a fresh Buffer line is exact.
    if (buffer && buffer.line.subcategories.length === 0) {
      const add = Math.round(convertCurrency(view.free, view.base, cur, rates) * 100) / 100
      patchLine(buffer.line.id, { amount: buffer.line.amount + add })
    } else {
      store.getState().addPlanCategory(planId, {
        name: 'Buffer', icon: 'layers', amount: view.free, block: 'grow', isSavings: true,
        currency: view.base, linkType: 'none', linkIds: [], dueDay: null, essential: false, locked: false,
        expenseCategories: [],
      })
    }
    toast(t.bufferMoved(formatCurrency(view.free, view.base, false)))
  }, [patchLine, planId, store, t, toast, view])

  const groupLegacyLines = useCallback(() => {
    if (!view || !planId) return
    store.getState().replaceBudgetPlanCategories(planId, upgradeLegacyLines(view.plan.categories))
    toast(t.grouped)
  }, [planId, store, t, toast, view])

  return {
    createStarterPlan,
    patchLine,
    deleteLine,
    addLine,
    syncLive,
    syncAllLive,
    moveFreeToBuffer,
    groupLegacyLines,
  }
}
