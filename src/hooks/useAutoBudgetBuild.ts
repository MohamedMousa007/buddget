'use client'

import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useFirstRunChecklist } from '@/lib/onboarding/firstRunChecklist'
import { computeBudgetFromChoices } from '@/lib/budget/lifestyleMappings'
import { generateBudgetPlan } from '@/lib/ai/generateBudgetPlan'
import { applyBudgetPlan } from '@/lib/budget/applyBudgetPlan'
import { ensureBudgetPlanId } from '@/lib/budget/ensureBudgetPlanId'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import type { FoodFrequency, TransportMode, LifestyleTier, HouseholdType } from '@/lib/budget/lifestyleMappings'

export type AutoBudgetBuildSource = 'ai' | 'fallback'

export interface AutoBudgetBuildResult {
  source: AutoBudgetBuildSource
  planId: string
}

/**
 * Single-shot budget builder the dashboard "Build My Budget" CTA fires once
 * all six checklist cards are done. Pulls every input from the store —
 * income from `incomeSources`, lifestyle + household + rent from `profile` —
 * runs the AI generator, applies the plan via `applyBudgetPlan`, and falls
 * back to the deterministic `computeBudgetFromChoices` seed if the AI fails
 * or times out. Users never see the interactive Buddgy flow.
 */
export function useAutoBudgetBuild() {
  const checklist = useFirstRunChecklist()

  const snap = useFinanceStore(
    useShallow((s) => ({
      incomeCount: s.incomeSources.length,
      baseCurrency: s.settings.baseCurrency,
      city: s.profile.city,
      country: s.profile.country,
      household: s.profile.household,
      lifestyleTier: s.profile.lifestyleTier,
      foodFrequency: s.profile.foodFrequency,
      transportMode: s.profile.transportMode,
      monthlyRent: s.profile.monthlyRent,
      rentIncludesUtilities: s.profile.rentIncludesUtilities ?? false,
      goalCount: s.goals.length,
    })),
  )

  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)

  // All six cards must be done; doneCount === totalCount is the cleanest gate.
  const canBuild = checklist.allDone && snap.incomeCount > 0 && !building

  const build = useCallback(async (): Promise<AutoBudgetBuildResult | null> => {
    if (!canBuild) return null
    setBuilding(true)
    setBuildError(null)

    const state = useFinanceStore.getState()
    const monthlyIncome = calculateMonthlyIncome(
      state.incomeSources,
      state.settings.baseCurrency,
      state.exchangeRates,
    )
    if (monthlyIncome <= 0) {
      setBuilding(false)
      setBuildError('no_income')
      return null
    }

    const household: HouseholdType = snap.household ?? 'solo'
    const food: FoodFrequency = snap.foodFrequency ?? 'sometimes'
    const transport: TransportMode = snap.transportMode ?? 'public'
    const tier: LifestyleTier = snap.lifestyleTier ?? 'balanced'
    const rent = snap.monthlyRent ?? 0

    const planId = ensureBudgetPlanId(() => useFinanceStore.getState())

    track(ONBOARDING_EVENTS.budgetAutoBuildStarted, {
      household,
      tier,
      goalCount: snap.goalCount,
    })

    // Deterministic seed — also the fallback if AI fails.
    const seed = computeBudgetFromChoices({
      income: monthlyIncome,
      currency: snap.baseCurrency,
      country: snap.country ?? null,
      household,
      rent,
      rentIncludesUtilities: snap.rentIncludesUtilities,
      food,
      transport,
      lifestyle: tier,
    })

    // Compact lifestyle-notes string for the AI prompt + goals notes.
    const goalNames = state.goals
      .map((g) => g.name)
      .filter(Boolean)
      .slice(0, 6)
      .join(', ')
    const lifestyleNotes =
      `tier=${tier}; food=${food}; transport=${transport}; household=${household}` +
      (goalNames ? `; goals=${goalNames}` : '')

    let categories = seed.categories
    let source: AutoBudgetBuildSource = 'fallback'

    try {
      const ai = await generateBudgetPlan({
        income: monthlyIncome,
        currency: snap.baseCurrency,
        city: snap.city || 'Unknown',
        household,
        lifestyleNotes,
        categories: seed.categories,
      })
      categories = ai.categories
      source = 'ai'
    } catch (e) {
      console.warn('[useAutoBudgetBuild] AI failed; applying deterministic seed', e)
      track(ONBOARDING_EVENTS.budgetAutoBuildFallback, {
        reason: e instanceof Error ? e.message.slice(0, 80) : 'unknown',
      })
    }

    try {
      applyBudgetPlan(() => useFinanceStore.getState(), {
        planId,
        categories,
        currency: snap.baseCurrency,
        financialGoalsNotes: lifestyleNotes,
      })
      track(ONBOARDING_EVENTS.budgetAutoBuilt, { source })
      setBuilding(false)
      return { source, planId }
    } catch (e) {
      console.error('[useAutoBudgetBuild] applyBudgetPlan failed', e)
      setBuildError('apply_failed')
      setBuilding(false)
      return null
    }
  }, [canBuild, snap])

  return { canBuild, building, buildError, build }
}
