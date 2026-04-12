'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { parseBudgetInput, type ParsedBudgetInput } from '@/lib/ai/parseBudgetInput'
import { generateBudgetPlan, type GeneratedPlan } from '@/lib/ai/generateBudgetPlan'
import {
  computeBudgetFromChoices,
  type FoodFrequency,
  type TransportMode,
  type LifestyleTier,
  type HouseholdType,
  type BudgetCategoryRow,
} from '@/lib/budget/lifestyleMappings'
import { pushProfileFieldsToSupabase } from '@/lib/profile/pushProfileFieldsToSupabase'
import type { Currency } from '@/lib/store/types'

export type BuilderStep = 'describe' | 'confirm' | 'lifestyle' | 'savings' | 'plan' | 'applied'

const STEP_ORDER: BuilderStep[] = ['describe', 'confirm', 'lifestyle', 'savings', 'plan', 'applied']

export interface ConfirmedBasics {
  income: number
  currency: Currency
  city: string
  country: string
  household: HouseholdType
  rent: number
  rentIncludesUtilities: boolean
}

export interface LifestyleChoices {
  food: FoodFrequency | null
  transport: TransportMode | null
  tier: LifestyleTier | null
}

/**
 * State machine for the Buddgy Builder v3 guided experience.
 * 2 AI calls total: parse (Step 0) + generate tip (Step 4).
 * Everything in between is deterministic UI.
 */
export function useBuddgyBuilderFlow(planId: string, onClose: () => void) {
  const {
    settings,
    incomeSources,
    addIncomeSource,
    updateIncomeSource,
    updateSettings,
    replaceBudgetPlanCategories,
    setFinancialGoalsNotes,
    updateBudgetPlan,
  } = useFinanceStore(
    useShallow((s) => ({
      settings: s.settings,
      incomeSources: s.incomeSources,
      addIncomeSource: s.addIncomeSource,
      updateIncomeSource: s.updateIncomeSource,
      updateSettings: s.updateSettings,
      replaceBudgetPlanCategories: s.replaceBudgetPlanCategories,
      setFinancialGoalsNotes: s.setFinancialGoalsNotes,
      updateBudgetPlan: s.updateBudgetPlan,
    }))
  )

  const [step, setStep] = useState<BuilderStep>('describe')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenCount, setRegenCount] = useState(0)

  // Step 0 result
  const [parsed, setParsed] = useState<ParsedBudgetInput | null>(null)

  // Step 1 — editable basics
  const [basics, setBasics] = useState<ConfirmedBasics>({
    income: 0,
    currency: settings.baseCurrency,
    city: '',
    country: '',
    household: 'solo',
    rent: 0,
    rentIncludesUtilities: true,
  })

  // Step 2 — lifestyle
  const [lifestyle, setLifestyle] = useState<LifestyleChoices>({
    food: null,
    transport: null,
    tier: null,
  })

  // Step 3 — savings
  const [savingsPercent, setSavingsPercent] = useState(70)

  // Step 4 — generated plan
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editedCategories, setEditedCategories] = useState<BudgetCategoryRow[]>([])

  const stepIndex = STEP_ORDER.indexOf(step)
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100

  // Computed budget from lifestyle choices
  const computedBudget = useMemo(() => {
    if (!lifestyle.food || !lifestyle.transport || !lifestyle.tier) return null
    return computeBudgetFromChoices({
      income: basics.income,
      currency: basics.currency,
      household: basics.household,
      rent: basics.rent,
      rentIncludesUtilities: basics.rentIncludesUtilities,
      food: lifestyle.food,
      transport: lifestyle.transport,
      lifestyle: lifestyle.tier,
    })
  }, [basics, lifestyle])

  const remaining = computedBudget?.remaining ?? 0
  const savingsAmount = Math.round(remaining * (savingsPercent / 100))
  const bufferAmount = remaining - savingsAmount

  // Step 0 → 1: Parse free text
  const submitDescription = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await parseBudgetInput(text)
      setParsed(result)

      const needsIncome = result.income.amount == null
      if (needsIncome && result.missingFields.includes('income')) {
        // Still advance, user edits in Step 1
      }

      const VALID_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', 'XAU']
      const parsedCur = (result.income.currency ?? '').toUpperCase() as Currency
      const currency: Currency = VALID_CURRENCIES.includes(parsedCur) ? parsedCur : settings.baseCurrency

      setBasics({
        income: result.income.amount ?? 0,
        currency,
        city: result.city ?? '',
        country: result.country ?? '',
        household: result.household ?? 'solo',
        rent: result.rent.amount ?? 0,
        rentIncludesUtilities: result.rent.includesUtilities,
      })

      if (result.savingsGoal === 'maximum') setSavingsPercent(100)
      else if (result.savingsGoal === 'moderate') setSavingsPercent(70)
      else if (result.savingsGoal === 'some') setSavingsPercent(50)

      setStep('confirm')
    } catch {
      setError('Could not process your input. Try again.')
    } finally {
      setLoading(false)
    }
  }, [settings.baseCurrency])

  // Step 1 → 2
  const confirmBasics = useCallback(() => {
    if (basics.income <= 0) return
    setStep('lifestyle')
  }, [basics.income])

  // Step 2 → 3
  const confirmLifestyle = useCallback(() => {
    if (!lifestyle.food || !lifestyle.transport || !lifestyle.tier) return
    setStep('savings')
  }, [lifestyle])

  // Step 3 → 4: Generate plan
  const generatePlan = useCallback(async () => {
    if (!computedBudget) return
    setLoading(true)
    setError(null)
    try {
      const allCategories: BudgetCategoryRow[] = [
        ...computedBudget.categories,
        { name: 'Savings', emoji: '💰', amount: savingsAmount, currency: basics.currency },
      ]

      const result = await generateBudgetPlan({
        income: basics.income,
        currency: basics.currency,
        city: basics.city || 'Unknown',
        household: basics.household,
        rent: basics.rent,
        rentIncludesUtilities: basics.rentIncludesUtilities,
        groceries: computedBudget.categories.find((c) => c.name === 'Groceries')?.amount ?? 0,
        dining: computedBudget.categories.find((c) => c.name === 'Dining Out')?.amount ?? 0,
        transport: computedBudget.categories.find((c) => c.name === 'Transport')?.amount ?? 0,
        transportMode: lifestyle.transport ?? 'public',
        entertainmentTotal: computedBudget.categories
          .filter((c) => ['Entertainment', 'Personal Care', 'Phone & Internet', 'Subscriptions'].includes(c.name))
          .reduce((s, c) => s + c.amount, 0),
        savingsAmount,
        bufferAmount,
        lifestyleNotes: parsed?.lifestyleNotes ?? null,
        categories: allCategories,
      })

      setPlan(result)
      setEditedCategories(result.categories)
      setRegenCount((c) => c + 1)
      setStep('plan')
    } catch {
      setError('Could not generate plan. Try again.')
    } finally {
      setLoading(false)
    }
  }, [computedBudget, basics, lifestyle, savingsAmount, bufferAmount, parsed])

  // Step 4 → 5: Apply plan
  const applyPlan = useCallback(() => {
    const cats = editingPlan ? editedCategories : plan?.categories
    if (!cats || cats.length === 0) return

    // 1. Update income
    const cur = basics.currency
    if (incomeSources.length === 0) {
      addIncomeSource({
        name: 'Monthly income',
        amount: basics.income,
        currency: cur,
        isRecurring: true,
        recurringFrequency: 'monthly',
      })
    } else {
      updateIncomeSource(incomeSources[0].id, {
        amount: basics.income,
        currency: cur,
        isRecurring: true,
        recurringFrequency: 'monthly',
      })
    }
    updateSettings({ noIncomeDeclared: false })

    // 2. Replace budget plan categories
    replaceBudgetPlanCategories(planId, cats.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      icon: c.emoji,
      amount: c.amount,
      currency: basics.currency,
      subcategories: [],
    })))

    // 3. Mark plan as complete
    updateBudgetPlan(planId, { buddgyGuidedComplete: true, buddgyFlow: null })

    // 4. Store financial goals
    if (parsed?.lifestyleNotes) {
      setFinancialGoalsNotes(parsed.lifestyleNotes)
    }

    // 5. Push profile updates
    if (basics.city || basics.country) {
      void pushProfileFieldsToSupabase({
        city: basics.city || undefined,
        country: basics.country || undefined,
      })
    }

    setStep('applied')
  }, [
    editingPlan, editedCategories, plan, basics, planId, parsed,
    incomeSources, addIncomeSource, updateIncomeSource, updateSettings,
    replaceBudgetPlanCategories, updateBudgetPlan, setFinancialGoalsNotes,
  ])

  const goBackToLifestyle = useCallback(() => {
    setStep('lifestyle')
  }, [])

  const updateEditedCategory = useCallback((index: number, amount: number) => {
    setEditedCategories((prev) => prev.map((c, i) => i === index ? { ...c, amount } : c))
  }, [])

  return {
    step,
    stepIndex,
    progress,
    loading,
    error,
    parsed,
    basics,
    setBasics,
    lifestyle,
    setLifestyle,
    savingsPercent,
    setSavingsPercent,
    remaining,
    savingsAmount,
    bufferAmount,
    plan,
    editingPlan,
    setEditingPlan,
    editedCategories,
    updateEditedCategory,
    regenCount,
    computedBudget,
    submitDescription,
    confirmBasics,
    confirmLifestyle,
    generatePlan,
    applyPlan,
    goBackToLifestyle,
    onClose,
    baseCurrency: settings.baseCurrency,
  }
}

export type BuddgyBuilderApi = ReturnType<typeof useBuddgyBuilderFlow>
