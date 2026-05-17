'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { ensureBudgetPlanId } from '@/lib/budget/ensureBudgetPlanId'
import { applyBudgetPlan } from '@/lib/budget/applyBudgetPlan'
import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { generateJourneyPlan } from '@/lib/onboarding/generateJourneyPlan'
import { finalizeOnboardingAuthSession } from '@/lib/onboarding/finalizeOnboardingClient'
import { buildBudgetPreviewContext, withTimeout } from '@/lib/onboarding/budgetPreviewContext'
import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'
import { isSavingsCategoryRow } from '@/lib/budget/lifestyleMappings'
import { computeBudgetPreviewSurplus } from '@/lib/onboarding/budgetPreviewSurplus'
import {
  applyOnboardingStepperDraft,
  ONBOARDING_COMPLETE_KEY,
} from '@/lib/onboarding/applyOnboardingStepperDraft'
import { EMPTY_DRAFT, type OnboardingDraft } from '@/lib/onboarding/onboardingDraft'
import { mergeRegeneratedCategoryAmounts } from '@/lib/budget/mergeRegeneratedCategories'

const DRAFT_LS = 'buddget-onboarding-draft'

function mergeCompleteDraft(raw: unknown): OnboardingDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<OnboardingDraft>
  return {
    ...EMPTY_DRAFT,
    ...r,
    incomeSources: Array.isArray(r.incomeSources) ? r.incomeSources : EMPTY_DRAFT.incomeSources,
    fixedCosts: Array.isArray(r.fixedCosts) ? r.fixedCosts : EMPTY_DRAFT.fixedCosts,
    subscriptions: Array.isArray(r.subscriptions) ? r.subscriptions : EMPTY_DRAFT.subscriptions,
    paymentMethods: Array.isArray(r.paymentMethods) ? r.paymentMethods : EMPTY_DRAFT.paymentMethods,
    debts: Array.isArray(r.debts) ? r.debts : EMPTY_DRAFT.debts,
  }
}

/**
 * Budget preview: hydrate from `buddget-onboarding-complete`, generate plan, edit, AI regenerate, confirm → dashboard.
 */
export function useBudgetPreviewPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<OnboardingDraft | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [categories, setCategories] = useState<BudgetCategoryRow[]>([])
  const [planSource, setPlanSource] = useState<'ai' | 'preset'>('preset')

  const [regenOpen, setRegenOpen] = useState(false)
  const [regenNotes, setRegenNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [regenStatus, setRegenStatus] = useState<string | null>(null)
  const [regenerateExplanation, setRegenerateExplanation] = useState<string | null>(null)

  const [confirmBusy, setConfirmBusy] = useState(false)

  const { baseCurrency, monthlyIncome } = useFinanceStore(
    useShallow((s) => ({
      baseCurrency: s.settings.baseCurrency,
      monthlyIncome: calculateMonthlyIncome(s.incomeSources, s.settings.baseCurrency, s.exchangeRates),
    })),
  )

  const draftFixedTotal = useMemo(
    () => (draft?.fixedCosts ?? []).reduce((s, f) => s + (f.amount > 0 ? f.amount : 0), 0),
    [draft],
  )

  const budgetedTotal = useMemo(
    () =>
      categories.filter((c) => !isSavingsCategoryRow(c)).reduce((s, c) => s + (c.amount > 0 ? c.amount : 0), 0),
    [categories],
  )

  const unallocated = useMemo(
    () => computeBudgetPreviewSurplus(monthlyIncome, draftFixedTotal, categories),
    [monthlyIncome, draftFixedTotal, categories],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setInitializing(true)
      setBootError(null)
      try {
        const raw = localStorage.getItem(ONBOARDING_COMPLETE_KEY)
        if (!raw) {
          router.replace('/onboarding')
          return
        }
        const parsed = mergeCompleteDraft(JSON.parse(raw))
        if (!parsed) {
          router.replace('/onboarding')
          return
        }
        applyOnboardingStepperDraft(parsed)
        if (cancelled) return

        const ctx = buildBudgetPreviewContext()
        const result = await withTimeout(generateJourneyPlan(ctx), 45_000, 'generateJourneyPlan')
        if (cancelled) return
        setDraft(parsed)
        setCategories(result.categories)
        setPlanSource(result.source === 'ai' ? 'ai' : 'preset')

        const planId = ensureBudgetPlanId(() => useFinanceStore.getState())
        applyBudgetPlan(() => useFinanceStore.getState(), {
          planId,
          categories: result.categories,
          currency: useFinanceStore.getState().settings.baseCurrency,
          financialGoalsNotes: ctx.feedback,
        })
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : 'Could not load preview')
        }
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const onCategoryAmount = useCallback((index: number, nextAmount: number) => {
    setCategories((prev) => {
      const next = [...prev]
      const row = next[index]
      if (!row) return prev
      next[index] = { ...row, amount: Math.max(0, Math.round(nextAmount)) }
      return next
    })
  }, [])

  const runRegenerate = useCallback(async () => {
    const notes = regenNotes.trim()
    if (!notes || !draft) return
    setAiBusy(true)
    setRegenStatus('Thinking about your feedback...')
    setRegenerateExplanation(null)
    const before = [...categories]
    try {
      const res = await withTimeout(
        fetch('/api/budget/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedbackText: notes,
            currentBudget: before,
            onboardingDraft: draft,
          }),
        }),
        45_000,
        'regenerateBudget',
      )

      const payload = (await res.json().catch(() => null)) as
        | { categories?: Record<string, number>; explanation?: string; error?: string }
        | null

      if (!res.ok) {
        const err = payload?.error?.trim()
        setRegenStatus(err || 'Could not update plan. Try again.')
        return
      }

      const aiCats = payload?.categories
      if (!aiCats || typeof aiCats !== 'object') {
        setRegenStatus('Could not update plan. Try again.')
        return
      }

      const next = mergeRegeneratedCategoryAmounts(before, aiCats, baseCurrency)
      const explanation =
        typeof payload.explanation === 'string' && payload.explanation.trim() ?
          payload.explanation.trim()
        : null

      setCategories(next)
      setRegenerateExplanation(explanation)
      setRegenOpen(false)
      setRegenNotes('')
      setPlanSource('ai')
      setRegenStatus(null)

      const planId = ensureBudgetPlanId(() => useFinanceStore.getState())
      const ctx = buildBudgetPreviewContext(notes)
      applyBudgetPlan(() => useFinanceStore.getState(), {
        planId,
        categories: next,
        currency: useFinanceStore.getState().settings.baseCurrency,
        financialGoalsNotes: ctx.feedback,
      })
    } catch {
      setRegenStatus('Could not update plan. Try again.')
    } finally {
      setAiBusy(false)
    }
  }, [baseCurrency, categories, draft, regenNotes])

  const onConfirm = useCallback(async () => {
    if (!draft) return
    setConfirmBusy(true)
    try {
      applyOnboardingStepperDraft(draft)
      const state = useFinanceStore.getState()
      const planId = ensureBudgetPlanId(() => useFinanceStore.getState())
      const ctx = buildBudgetPreviewContext()
      applyBudgetPlan(() => useFinanceStore.getState(), {
        planId,
        categories,
        currency: state.settings.baseCurrency,
        financialGoalsNotes: ctx.feedback,
      })
      await withTimeout(flushFinanceNow(), 12_000, 'flushFinanceNow')
      await finalizeOnboardingAuthSession()
      try {
        localStorage.removeItem(DRAFT_LS)
        localStorage.removeItem(ONBOARDING_COMPLETE_KEY)
      } catch {
        /* ignore */
      }
      // Hand off to /budget-setup with ?tour=1 so PostOnboardingTourBoot
      // arms the guided tour. The tour's first step lives on this route
      // and the controller walks the user from there to the dashboard.
      router.replace('/budget-setup?tour=1')
    } catch (e) {
      console.error('[useBudgetPreviewPage] confirm', e)
    } finally {
      setConfirmBusy(false)
    }
  }, [categories, draft, router])

  const onSkip = useCallback(() => {
    router.replace('/onboarding')
  }, [router])

  return {
    draft,
    initializing,
    bootError,
    baseCurrency,
    monthlyIncome,
    categories,
    planSource,
    draftFixedTotal,
    budgetedTotal,
    unallocated,
    onCategoryAmount,
    regenOpen,
    setRegenOpen,
    regenNotes,
    setRegenNotes,
    runRegenerate,
    aiBusy,
    regenStatus,
    regenerateExplanation,
    onConfirm,
    confirmBusy,
    onSkip,
  }
}
