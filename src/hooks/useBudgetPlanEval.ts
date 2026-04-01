'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetPlan, Currency } from '@/lib/store/types'
import {
  buildBudgetPlannerContextBlock,
  evaluateBudgetPlanWithAi,
  type BudgetPlanEvalResult,
} from '@/lib/ai/budgetPlannerAi'
import { SYSTEM_RESTING_MESSAGE } from '@/lib/ai/generateWithFallback'

const DEBOUNCE_MS = 2000

function planFingerprint(plan: BudgetPlan): string {
  return JSON.stringify({
    id: plan.id,
    name: plan.name,
    cats: plan.categories.map((c) => ({
      id: c.id,
      n: c.name,
      i: c.icon,
      a: c.amount,
      s: c.subcategories.map((x) => [x.id, x.name, x.amount]),
    })),
  })
}

/**
 * Debounced AI evaluation of the active budget plan (rating + short explanation).
 */
export function useBudgetPlanEval(plan: BudgetPlan | null, totalMonthlyIncome: number, baseCurrency: Currency) {
  const [result, setResult] = useState<BudgetPlanEvalResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const planSig = useMemo(() => (plan ? planFingerprint(plan) : ''), [plan])

  const runEval = useCallback(
    async (p: BudgetPlan) => {
      const block = buildBudgetPlannerContextBlock(p, totalMonthlyIncome, baseCurrency)
      setLoading(true)
      setError(null)
      try {
        const out = await evaluateBudgetPlanWithAi(block)
        setResult(out)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg === SYSTEM_RESTING_MESSAGE ? msg : msg)
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    [totalMonthlyIncome, baseCurrency]
  )

  useEffect(() => {
    if (!plan) {
      setResult(null)
      setLoading(false)
      setError(null)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void runEval(plan)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [plan, planSig, totalMonthlyIncome, baseCurrency, runEval])

  return { result, loading, error, refresh: () => plan && void runEval(plan) }
}
