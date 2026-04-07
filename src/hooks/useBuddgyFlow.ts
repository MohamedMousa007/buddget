'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { BudgetHousehold, BudgetPlan, Currency, IncomeSource } from '@/lib/store/types'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { findCategoryByName, plannedExcludingSavings } from '@/lib/budget/buddgyFlowHelpers'
import { pushProfileFieldsToSupabase } from '@/lib/profile/pushProfileFieldsToSupabase'

export type BuddgyFlowStep =
  | 'income'
  | 'household'
  | 'rent'
  | 'dewa'
  | 'transportMode'
  | 'transportDetail'
  | 'savings'
  | 'summary'

function hasDewaSub(plan: BudgetPlan): boolean {
  const rent = findCategoryByName(plan, 'Rent')
  return Boolean(rent?.subcategories.some((s) => s.name.toLowerCase().includes('dewa')))
}

function deriveResumeStep(plan: BudgetPlan | null, monthlyIncome: number): BuddgyFlowStep {
  if (!plan) return 'income'
  if (plan.buddgyGuidedComplete) return 'summary'
  if (monthlyIncome <= 0.0001) return 'income'
  if (!plan.household) return 'household'
  if (!findCategoryByName(plan, 'Rent')) return 'rent'
  if (plan.buddgyFlow?.rentIncludesUtilities === false && !hasDewaSub(plan)) return 'dewa'
  if (!plan.buddgyFlow?.transportMode) return 'transportMode'
  const mode = plan.buddgyFlow.transportMode
  if (mode === 'walk') {
    if (!findCategoryByName(plan, 'Savings')) return 'savings'
  } else if (!findCategoryByName(plan, 'Transport')) {
    return 'transportDetail'
  }
  if (!findCategoryByName(plan, 'Savings')) return 'savings'
  return 'summary'
}

function stepToProgress(s: BuddgyFlowStep): number {
  const order: BuddgyFlowStep[] = [
    'income',
    'household',
    'rent',
    'dewa',
    'transportMode',
    'transportDetail',
    'savings',
    'summary',
  ]
  const i = order.indexOf(s)
  return Math.round(((i + 1) / order.length) * 100)
}

/** Linear wizard steps for this plan (excludes summary). */
export function buildBuddgyFlowOrder(plan: BudgetPlan | null): BuddgyFlowStep[] {
  const o: BuddgyFlowStep[] = ['income', 'household', 'rent']
  const rent = plan && findCategoryByName(plan, 'Rent')
  const needsDewa = Boolean(rent && plan.buddgyFlow?.rentIncludesUtilities === false)
  if (needsDewa) o.push('dewa')
  o.push('transportMode')
  const tm = plan?.buddgyFlow?.transportMode
  if (tm && tm !== 'walk') o.push('transportDetail')
  o.push('savings')
  return o
}

export function getPreviousBuddgyStep(step: BuddgyFlowStep, plan: BudgetPlan | null): BuddgyFlowStep | null {
  if (step === 'summary') {
    const order = buildBuddgyFlowOrder(plan)
    return order[order.length - 1] ?? 'savings'
  }
  const order = buildBuddgyFlowOrder(plan)
  const i = order.indexOf(step)
  if (i <= 0) return null
  return order[i - 1] ?? null
}

/** Map transportDetail to the "transport" dot index (transportMode position). */
export function buddgyDotIndexForStep(step: BuddgyFlowStep, plan: BudgetPlan | null): number {
  const order = buildBuddgyFlowOrder(plan)
  const key = step === 'transportDetail' ? 'transportMode' : step
  const idx = order.indexOf(key as BuddgyFlowStep)
  return idx >= 0 ? idx : 0
}

export type UseBuddgyFlowOptions = {
  onFlowComplete?: () => void
  /** Parent resets plan + remounts flow (e.g. "Rebuild with Buddgy" / summary Adjust). */
  onRestartWizard?: () => void
  /** `restart` starts at income; `resume` continues from store. */
  mode?: 'resume' | 'restart'
}

export function useBuddgyFlow(planId: string | null, options?: UseBuddgyFlowOptions) {
  const {
    budgetPlans,
    incomeSources,
    settings,
    exchangeRates,
    updateBudgetPlan,
    updateBudgetMeta,
    addPlanCategory,
    updatePlanCategory,
    addPlanSubcategory,
    addIncomeSource,
    updateIncomeSource,
    updateSettings,
  } = useFinanceStore(
    useShallow((s) => ({
      budgetPlans: s.budgetPlans,
      incomeSources: s.incomeSources,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      updateBudgetPlan: s.updateBudgetPlan,
      updateBudgetMeta: s.updateBudgetMeta,
      addPlanCategory: s.addPlanCategory,
      updatePlanCategory: s.updatePlanCategory,
      addPlanSubcategory: s.addPlanSubcategory,
      addIncomeSource: s.addIncomeSource,
      updateIncomeSource: s.updateIncomeSource,
      updateSettings: s.updateSettings,
    }))
  )

  const plan = useMemo(
    () => (planId ? budgetPlans.find((p) => p.id === planId) ?? null : null),
    [budgetPlans, planId]
  )

  const monthlyIncome = useMemo(
    () => calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates),
    [incomeSources, settings.baseCurrency, exchangeRates]
  )

  const primaryIncomePreview = useMemo((): Pick<IncomeSource, 'amount' | 'currency'> | null => {
    const first = incomeSources[0]
    if (!first) return null
    return { amount: first.amount, currency: first.currency }
  }, [incomeSources])

  const flowMode = options?.mode ?? 'resume'

  const [step, setStep] = useState<BuddgyFlowStep>('income')
  const [showFlash, setShowFlash] = useState(false)
  const stepInitDone = useRef(false)
  /** After jumping from summary to edit a step, next forward navigation returns here. */
  const returnToSummaryAfterEditRef = useRef(false)

  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCurrency, setIncomeCurrency] = useState<Currency>(settings.baseCurrency)
  const [household, setHousehold] = useState<BudgetHousehold | null>(null)
  const [rentAmount, setRentAmount] = useState('')
  const [rentIncludes, setRentIncludes] = useState(true)
  const [dewaAmount, setDewaAmount] = useState('')
  const [transportMode, setTransportMode] = useState<'car' | 'public' | 'walk' | 'mix' | null>(null)
  const [transportCarMonthly, setTransportCarMonthly] = useState('')
  const [transportPublicDaily, setTransportPublicDaily] = useState('')
  const [savingsAmount, setSavingsAmount] = useState(0)
  const [savingsNextLoading, setSavingsNextLoading] = useState(false)
  const [savingsMode, setSavingsMode] = useState<'maximum' | 'custom'>('custom')
  const savingsInitDone = useRef(false)

  useEffect(() => {
    if (!plan) return
    setIncomeCurrency(settings.baseCurrency)
    if (incomeSources[0]) {
      setIncomeAmount(String(incomeSources[0].amount))
      setIncomeCurrency(incomeSources[0].currency)
    }
    if (plan.household) setHousehold(plan.household)
    const rent = findCategoryByName(plan, 'Rent')
    if (rent) {
      setRentAmount(String(rent.amount))
      setRentIncludes(plan.buddgyFlow?.rentIncludesUtilities !== false)
    }
    if (plan.buddgyFlow?.dewaMonthly !== undefined) setDewaAmount(String(plan.buddgyFlow.dewaMonthly))
    if (plan.buddgyFlow?.transportMode) setTransportMode(plan.buddgyFlow.transportMode)
    if (plan.buddgyFlow?.transportCarMonthly !== undefined) {
      setTransportCarMonthly(String(plan.buddgyFlow.transportCarMonthly))
    }
    if (plan.buddgyFlow?.transportPublicDaily !== undefined) {
      setTransportPublicDaily(String(plan.buddgyFlow.transportPublicDaily))
    }
  }, [plan, incomeSources, settings.baseCurrency])

  useEffect(() => {
    stepInitDone.current = false
    savingsInitDone.current = false
  }, [planId, options?.mode])

  useEffect(() => {
    if (!plan || stepInitDone.current) return
    stepInitDone.current = true
    const inc = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
    if (options?.mode === 'restart') {
      setStep('income')
      return
    }
    setStep(deriveResumeStep(plan, inc))
  }, [plan, options?.mode, incomeSources, settings.baseCurrency, exchangeRates])

  const triggerFlash = useCallback(() => {
    setShowFlash(true)
    globalThis.setTimeout(() => setShowFlash(false), 600)
  }, [])

  const ensureIncome = useCallback(
    (amount: number, currency: Currency) => {
      const c = clampFiatToAllowed(settings, currency)
      if (incomeSources.length === 0) {
        addIncomeSource({
          name: 'Monthly income',
          amount,
          currency: c,
          isRecurring: true,
          recurringFrequency: 'monthly',
        })
      } else {
        updateIncomeSource(incomeSources[0].id, {
          amount,
          currency: c,
          isRecurring: true,
          recurringFrequency: 'monthly',
        })
      }
      updateSettings({ noIncomeDeclared: false })
      triggerFlash()
      const p = useFinanceStore.getState().profile
      void pushProfileFieldsToSupabase({
        name: p.name?.trim() || undefined,
        city: p.city?.trim() || undefined,
        country: p.country?.trim() || undefined,
      })
    },
    [addIncomeSource, incomeSources, updateIncomeSource, updateSettings, settings, triggerFlash]
  )

  const saveHousehold = useCallback(
    (h: BudgetHousehold) => {
      if (!planId) return
      setHousehold(h)
      updateBudgetMeta(planId, { household: h })
      triggerFlash()
    },
    [planId, updateBudgetMeta, triggerFlash]
  )

  const saveRent = useCallback(() => {
    if (!planId || !plan) return
    const amt = Number.parseFloat(rentAmount.replace(/,/g, '')) || 0
    const cur = clampFiatToAllowed(settings, incomeCurrency)
    const existing = findCategoryByName(plan, 'Rent')
    if (existing) {
      updatePlanCategory(planId, existing.id, {
        amount: amt,
        currency: cur,
        name: 'Rent',
        icon: '🏠',
      })
    } else {
      addPlanCategory(planId, {
        name: 'Rent',
        icon: '🏠',
        amount: amt,
        currency: cur,
        subcategories: [],
      })
    }
    updateBudgetMeta(planId, {
      buddgyFlow: { ...plan.buddgyFlow, rentIncludesUtilities: rentIncludes },
    })
    triggerFlash()
  }, [planId, plan, rentAmount, rentIncludes, incomeCurrency, settings, addPlanCategory, updatePlanCategory, updateBudgetMeta, triggerFlash])

  const saveDewa = useCallback(() => {
    if (!planId || !plan) return
    const rent = findCategoryByName(plan, 'Rent')
    if (!rent) return
    const amt = Number.parseFloat(dewaAmount.replace(/,/g, '')) || 0
    const dewaSub = rent.subcategories.find((s) => s.name.toLowerCase().includes('dewa'))
    if (dewaSub) {
      updatePlanCategory(planId, rent.id, {
        subcategories: rent.subcategories.map((s) =>
          s.id === dewaSub.id ? { ...s, name: 'DEWA', amount: amt } : s
        ),
      })
    } else {
      addPlanSubcategory(planId, rent.id, { name: 'DEWA', amount: amt, icon: '⚡' })
    }
    updateBudgetMeta(planId, {
      buddgyFlow: { ...plan.buddgyFlow, dewaMonthly: amt },
    })
    triggerFlash()
  }, [planId, plan, dewaAmount, addPlanSubcategory, updatePlanCategory, updateBudgetMeta, triggerFlash])

  const commitWalkTransport = useCallback(() => {
    if (!planId || !plan) return
    updateBudgetMeta(planId, { buddgyFlow: { ...plan.buddgyFlow, transportMode: 'walk' } })
    triggerFlash()
  }, [planId, plan, updateBudgetMeta, triggerFlash])

  const saveTransportFromDetail = useCallback(() => {
    if (!planId || !plan || !transportMode) return
    const cur = clampFiatToAllowed(settings, settings.baseCurrency)
    if (transportMode === 'walk') {
      commitWalkTransport()
      return
    }
    let monthly = 0
    if (transportMode === 'public') {
      const daily = Number.parseFloat(transportPublicDaily.replace(/,/g, '')) || 0
      monthly = daily * 30
      updateBudgetMeta(planId, {
        buddgyFlow: {
          ...plan.buddgyFlow,
          transportMode,
          transportPublicDaily: daily,
        },
      })
    } else {
      monthly = Number.parseFloat(transportCarMonthly.replace(/,/g, '')) || 0
      updateBudgetMeta(planId, {
        buddgyFlow: {
          ...plan.buddgyFlow,
          transportMode,
          transportCarMonthly: monthly,
        },
      })
    }
    const existing = findCategoryByName(plan, 'Transport')
    const icon = transportMode === 'public' ? '🚌' : '🚗'
    if (existing) {
      updatePlanCategory(planId, existing.id, {
        amount: monthly,
        currency: cur,
        name: 'Transport',
        icon,
      })
    } else {
      addPlanCategory(planId, {
        name: 'Transport',
        icon,
        amount: monthly,
        currency: cur,
        subcategories: [],
      })
    }
    triggerFlash()
  }, [
    planId,
    plan,
    transportMode,
    transportPublicDaily,
    transportCarMonthly,
    settings,
    updateBudgetMeta,
    addPlanCategory,
    updatePlanCategory,
    triggerFlash,
    commitWalkTransport,
  ])

  const saveSavings = useCallback(() => {
    if (!planId || !plan) return
    const cur = clampFiatToAllowed(settings, settings.baseCurrency)
    const existing = findCategoryByName(plan, 'Savings')
    if (existing) {
      updatePlanCategory(planId, existing.id, {
        amount: savingsAmount,
        currency: cur,
        name: 'Savings',
        icon: '💰',
      })
    } else {
      addPlanCategory(planId, {
        name: 'Savings',
        icon: '💰',
        amount: savingsAmount,
        currency: cur,
        subcategories: [],
      })
    }
    updateBudgetMeta(planId, {
      buddgyFlow: { ...plan.buddgyFlow },
    })
    triggerFlash()
  }, [planId, plan, savingsAmount, settings, addPlanCategory, updatePlanCategory, updateBudgetMeta, triggerFlash])

  const finishFlow = useCallback(() => {
    if (planId && plan) {
      updateBudgetPlan(planId, { buddgyFlow: null, buddgyGuidedComplete: true })
    }
    options?.onFlowComplete?.()
  }, [planId, plan, updateBudgetPlan, options])

  const progress = useMemo(() => stepToProgress(step), [step])

  const advanceFromStep = useCallback(
    (
      from: BuddgyFlowStep,
      ctx?: { transportModePicked?: 'car' | 'public' | 'walk' | 'mix' }
    ) => {
      if (returnToSummaryAfterEditRef.current) {
        returnToSummaryAfterEditRef.current = false
        setStep('summary')
        return
      }
      if (from === 'income') setStep('household')
      else if (from === 'household') setStep('rent')
      else if (from === 'rent') {
        if (!rentIncludes) setStep('dewa')
        else setStep('transportMode')
      } else if (from === 'dewa') setStep('transportMode')
      else if (from === 'transportMode') {
        const m = ctx?.transportModePicked ?? transportMode
        if (m && m !== 'walk') setStep('transportDetail')
        else setStep('savings')
      } else if (from === 'transportDetail') setStep('savings')
      else if (from === 'savings') setStep('summary')
    },
    [rentIncludes, transportMode]
  )

  const goBack = useCallback(() => {
    returnToSummaryAfterEditRef.current = false
    const latest = useFinanceStore.getState().budgetPlans.find((p) => p.id === planId) ?? plan
    const prev = getPreviousBuddgyStep(step, latest)
    if (prev) setStep(prev)
  }, [step, planId, plan])

  const prepareJumpFromSummary = useCallback(() => {
    returnToSummaryAfterEditRef.current = true
  }, [])

  const navigateToDotFromSummary = useCallback(
    (dotIndex: number) => {
      const latest = useFinanceStore.getState().budgetPlans.find((p) => p.id === planId) ?? plan
      const order = buildBuddgyFlowOrder(latest)
      const target = order[dotIndex]
      if (target) {
        prepareJumpFromSummary()
        setStep(target)
      }
    },
    [planId, plan, prepareJumpFromSummary]
  )

  const restartGuidedWizard = useCallback(() => {
    options?.onRestartWizard?.()
  }, [options])

  const onSavingsNext = useCallback(async () => {
    setSavingsNextLoading(true)
    try {
      await new Promise((r) => globalThis.setTimeout(r, 350))
      saveSavings()
      advanceFromStep('savings')
    } finally {
      setSavingsNextLoading(false)
    }
  }, [saveSavings, advanceFromStep])

  const maxSavings = useMemo(() => {
    if (!plan) return 0
    const inc = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
    const planned = plannedExcludingSavings(plan, settings.baseCurrency, exchangeRates)
    return Math.max(0, inc - planned)
  }, [plan, incomeSources, settings.baseCurrency, exchangeRates])

  useEffect(() => {
    if (!plan || step !== 'savings') return
    if (savingsInitDone.current) return
    savingsInitDone.current = true
    setSavingsAmount(Math.round(maxSavings * 0.52))
  }, [plan, step, maxSavings])

  return {
    step,
    setStep,
    progress,
    showFlash,
    monthlyIncome,
    primaryIncomePreview,
    flowMode,
    plan,
    maxSavings,
    incomeAmount,
    setIncomeAmount,
    incomeCurrency,
    setIncomeCurrency,
    household,
    setHousehold,
    rentAmount,
    setRentAmount,
    rentIncludes,
    setRentIncludes,
    dewaAmount,
    setDewaAmount,
    transportMode,
    setTransportMode,
    transportCarMonthly,
    setTransportCarMonthly,
    transportPublicDaily,
    setTransportPublicDaily,
    savingsAmount,
    setSavingsAmount,
    savingsNextLoading,
    savingsMode,
    setSavingsMode,
    settings,
    exchangeRates,
    incomeSources,
    ensureIncome,
    saveHousehold,
    saveRent,
    saveDewa,
    saveTransportFromDetail,
    commitWalkTransport,
    saveSavings,
    finishFlow,
    triggerFlash,
    advanceFromStep,
    goBack,
    prepareJumpFromSummary,
    navigateToDotFromSummary,
    restartGuidedWizard,
    onSavingsNext,
    buildBuddgyFlowOrder,
    buddgyDotIndexForStep,
  }
}

export type BuddgyFlowApi = ReturnType<typeof useBuddgyFlow>
