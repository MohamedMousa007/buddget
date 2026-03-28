'use client'

import { useMemo, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ExpenseCategory, OnboardingAiPlan } from '@/lib/store/types'
import { normalizeCategoryPercents } from '@/lib/onboarding/planNormalization'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export function useOnboardingPlanPicker(plans: OnboardingAiPlan[]) {
  const [idx, setIdx] = useState(0)
  const [edited, setEdited] = useState<Record<ExpenseCategory, number> | null>(null)

  const { incomeSources, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    }))
  )

  const monthlyTakeHome = useMemo(
    () => calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates),
    [incomeSources, settings.baseCurrency, exchangeRates]
  )

  const plan = plans[idx]
  const percents = useMemo(() => {
    if (!plan) return null
    return edited ?? plan.percents
  }, [plan, edited])

  const setPct = useCallback(
    (c: ExpenseCategory, v: string) => {
      const basePlan = plans[idx]
      if (!basePlan) return
      const n = parseFloat(v.replace(/,/g, '.'))
      if (!Number.isFinite(n)) return
      const clamped = Math.max(0, Math.min(100, n))
      const base = edited ?? { ...basePlan.percents }
      const next = { ...base, [c]: clamped }
      setEdited(normalizeCategoryPercents(next as Record<string, number>))
    },
    [edited, idx, plans]
  )

  const setAmt = useCallback(
    (c: ExpenseCategory, v: string) => {
      const basePlan = plans[idx]
      if (!basePlan) return
      const n = parseFloat(v.replace(/,/g, '.'))
      if (!Number.isFinite(n) || n < 0) return
      if (monthlyTakeHome <= 0) return
      const newPct = (n / monthlyTakeHome) * 100
      const base = edited ?? { ...basePlan.percents }
      const next = { ...base, [c]: newPct }
      setEdited(normalizeCategoryPercents(next as Record<string, number>))
    },
    [edited, idx, monthlyTakeHome, plans]
  )

  const clearEdited = useCallback(() => setEdited(null), [])

  const goPrev = useCallback(() => {
    clearEdited()
    setIdx((i) => i - 1)
  }, [clearEdited])

  const goNext = useCallback(() => {
    clearEdited()
    setIdx((i) => i + 1)
  }, [clearEdited])

  const acceptPayload: OnboardingAiPlan | null =
    plan && percents ? (edited ? { ...plan, percents: edited } : plan) : null

  return {
    idx,
    plansLength: plans.length,
    plan,
    percents,
    monthlyTakeHome,
    settings,
    setPct,
    setAmt,
    goPrev,
    goNext,
    acceptPayload,
    clearEdited,
  }
}
