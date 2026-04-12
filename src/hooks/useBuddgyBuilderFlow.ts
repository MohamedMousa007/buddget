'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  applyRegenerateTweak,
  redistributeFlexibleExpenseRows,
  type RegenerateTweak,
} from '@/lib/budget/buddgyBuilderRedistribution'
import { pushProfileFieldsToSupabase } from '@/lib/profile/pushProfileFieldsToSupabase'
import type { Currency } from '@/lib/store/types'

export type BuilderStep = 'describe' | 'confirm' | 'lifestyle' | 'savings' | 'applied'

export const BUDDGY_BUILDER_STEP_ORDER: BuilderStep[] = ['describe', 'confirm', 'lifestyle', 'savings', 'applied']

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

export type BuddgyBuilderLoadingKind = 'idle' | 'parse' | 'plan'

export interface BuddgyBuilderOpenOptions {
  initialDescribeText?: string
  knownIncome?: { amount: number; currency: Currency }
}

/**
 * State machine for Buddgy Builder: describe → confirm → lifestyle → savings (preview + confirm) → applied.
 * Parse + plan generation are the only AI calls.
 */
export function useBuddgyBuilderFlow(
  planId: string,
  onClose: () => void,
  options?: BuddgyBuilderOpenOptions
) {
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
  const [loadingKind, setLoadingKind] = useState<BuddgyBuilderLoadingKind>('idle')
  const [error, setError] = useState<string | null>(null)
  const [regenCount, setRegenCount] = useState(0)
  const [extraAiContext, setExtraAiContext] = useState<string[]>([])
  const [rentAdjustHint, setRentAdjustHint] = useState<string | null>(null)

  const [parsed, setParsed] = useState<ParsedBudgetInput | null>(null)
  const [describeText, setDescribeText] = useState(() => options?.initialDescribeText ?? '')

  const [basics, setBasics] = useState<ConfirmedBasics>({
    income: 0,
    currency: settings.baseCurrency,
    city: '',
    country: '',
    household: 'solo',
    rent: 0,
    rentIncludesUtilities: true,
  })

  const [lifestyle, setLifestyle] = useState<LifestyleChoices>({
    food: null,
    transport: null,
    tier: null,
  })

  const [savingsPercent, setSavingsPercent] = useState(70)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [expenseBaseOverride, setExpenseBaseOverride] = useState<BudgetCategoryRow[] | null>(null)

  const stepIndex = BUDDGY_BUILDER_STEP_ORDER.indexOf(step)
  const loading = loadingKind !== 'idle'

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

  useEffect(() => {
    setExpenseBaseOverride(null)
    setExtraAiContext([])
    setRegenCount(0)
  }, [lifestyle.food, lifestyle.transport, lifestyle.tier])

  const rawExpenseBase = useMemo(
    () => expenseBaseOverride ?? computedBudget?.categories ?? [],
    [expenseBaseOverride, computedBudget]
  )

  const remainingPool = useMemo(() => {
    if (basics.income <= 0 || rawExpenseBase.length === 0) return 0
    const spent = rawExpenseBase.reduce((s, r) => s + r.amount, 0)
    return Math.max(0, basics.income - spent)
  }, [basics.income, rawExpenseBase])

  const savingsAmountTarget = useMemo(
    () => Math.round(remainingPool * (savingsPercent / 100)),
    [remainingPool, savingsPercent]
  )

  const redistributed = useMemo(() => {
    if (rawExpenseBase.length === 0 || basics.income <= 0) {
      return {
        rows: [] as BudgetCategoryRow[],
        savingsAmount: 0,
        totalExpenses: 0,
      }
    }
    return redistributeFlexibleExpenseRows(rawExpenseBase, basics.income, savingsAmountTarget)
  }, [rawExpenseBase, basics.income, savingsAmountTarget])

  const displayExpenseRows = redistributed.rows
  const savingsAmount = redistributed.savingsAmount
  const totalPlannedExpenses = redistributed.totalExpenses

  const submitDescription = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length < 10) return
      setLoadingKind('parse')
      setError(null)
      try {
        const known = options?.knownIncome
        const result = await parseBudgetInput(trimmed, {
          knownIncome:
            known && known.amount > 0 ?
              { amount: known.amount, currency: known.currency }
            : undefined,
          preamble: undefined,
        })
        setParsed(result)

        const VALID_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', 'XAU']
        const parsedCur = (result.income.currency ?? '').toUpperCase() as Currency
        const fromParse = VALID_CURRENCIES.includes(parsedCur) ? parsedCur : settings.baseCurrency
        const incomeAmt =
          result.income.amount != null && result.income.amount > 0 ?
            result.income.amount
          : known && known.amount > 0 ? known.amount
          : 0
        const currency: Currency =
          result.income.amount != null && result.income.amount > 0 ? fromParse
          : known && known.amount > 0 ? known.currency
          : fromParse

        setBasics({
          income: incomeAmt,
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
        setLoadingKind('idle')
      }
    },
    [options?.knownIncome, settings.baseCurrency]
  )

  const confirmBasics = useCallback(() => {
    if (basics.income <= 0) return
    setStep('lifestyle')
  }, [basics.income])

  const confirmLifestyle = useCallback(() => {
    if (!lifestyle.food || !lifestyle.transport || !lifestyle.tier) return
    setStep('savings')
  }, [lifestyle])

  const mergedLifestyleNotes = useMemo(() => {
    const parts = [parsed?.lifestyleNotes, ...extraAiContext].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(' | ') : null
  }, [parsed?.lifestyleNotes, extraAiContext])

  const applyCategoriesToStore = useCallback(
    (cats: BudgetCategoryRow[]) => {
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

      replaceBudgetPlanCategories(
        planId,
        cats.map((c) => ({
          id: crypto.randomUUID(),
          name: c.name,
          icon: c.emoji,
          amount: c.amount,
          currency: basics.currency,
          ...(c.isSavings === true ? { isSavings: true as const } : {}),
          subcategories: [],
        }))
      )

      updateBudgetPlan(planId, { buddgyGuidedComplete: true, buddgyFlow: null })

      if (parsed?.lifestyleNotes || extraAiContext.length > 0) {
        const note = [parsed?.lifestyleNotes, ...extraAiContext].filter(Boolean).join(' | ')
        if (note.trim()) setFinancialGoalsNotes(note.trim())
      }

      if (basics.city || basics.country) {
        void pushProfileFieldsToSupabase({
          city: basics.city || undefined,
          country: basics.country || undefined,
        })
      }
    },
    [
      basics,
      planId,
      incomeSources,
      addIncomeSource,
      updateIncomeSource,
      updateSettings,
      replaceBudgetPlanCategories,
      updateBudgetPlan,
      parsed?.lifestyleNotes,
      extraAiContext,
      setFinancialGoalsNotes,
    ]
  )

  const confirmAndApplyPlan = useCallback(async () => {
    if (displayExpenseRows.length === 0 || basics.income <= 0) return
    setLoadingKind('plan')
    setError(null)
    try {
      const allCategories: BudgetCategoryRow[] = [
        ...displayExpenseRows,
        {
          name: 'Savings',
          emoji: '💰',
          amount: savingsAmount,
          currency: basics.currency,
          isSavings: true,
        },
      ]

      const bufferAmount = Math.max(0, basics.income - totalPlannedExpenses - savingsAmount)

      const result = await generateBudgetPlan({
        income: basics.income,
        currency: basics.currency,
        city: basics.city || 'Unknown',
        household: basics.household,
        rent: basics.rent,
        rentIncludesUtilities: basics.rentIncludesUtilities,
        groceries: displayExpenseRows.find((c) => c.name === 'Groceries')?.amount ?? 0,
        dining: displayExpenseRows.find((c) => c.name === 'Dining Out')?.amount ?? 0,
        transport: displayExpenseRows.find((c) => c.name === 'Transport')?.amount ?? 0,
        transportMode: lifestyle.transport ?? 'public',
        entertainmentTotal: displayExpenseRows
          .filter((c) =>
            ['Entertainment', 'Personal Care', 'Phone & Internet', 'Subscriptions'].includes(c.name)
          )
          .reduce((s, c) => s + c.amount, 0),
        savingsAmount,
        bufferAmount,
        lifestyleNotes: mergedLifestyleNotes,
        categories: allCategories,
      })

      setPlan(result)
      applyCategoriesToStore(result.categories)
      setStep('applied')
    } catch {
      setError('Could not finalize your plan. Try again.')
    } finally {
      setLoadingKind('idle')
    }
  }, [
    displayExpenseRows,
    basics,
    savingsAmount,
    totalPlannedExpenses,
    lifestyle.transport,
    mergedLifestyleNotes,
    applyCategoriesToStore,
  ])

  const goBack = useCallback(() => {
    setError(null)
    if (step === 'confirm') setStep('describe')
    else if (step === 'lifestyle') setStep('confirm')
    else if (step === 'savings') setStep('lifestyle')
  }, [step])

  const submitRegenerateFeedback = useCallback(
    (tweak: RegenerateTweak, customNote: string | null) => {
      if (regenCount >= 3) return
      if (rawExpenseBase.length === 0) return
      const { rows, noteForAi, rentNote } = applyRegenerateTweak(rawExpenseBase, tweak, customNote)
      setExpenseBaseOverride(rows)
      if (noteForAi) setExtraAiContext((prev) => [...prev, noteForAi])
      if (rentNote) setRentAdjustHint(rentNote)
      else setRentAdjustHint(null)
      setRegenCount((c) => c + 1)
    },
    [regenCount, rawExpenseBase]
  )

  return {
    step,
    stepIndex,
    loading,
    loadingKind,
    error,
    parsed,
    basics,
    setBasics,
    lifestyle,
    setLifestyle,
    savingsPercent,
    setSavingsPercent,
    remainingPool,
    savingsAmount,
    totalPlannedExpenses,
    displayExpenseRows,
    plan,
    regenCount,
    computedBudget,
    describeText,
    setDescribeText,
    initialDescribeText: options?.initialDescribeText ?? '',
    knownIncome: options?.knownIncome,
    submitDescription,
    confirmBasics,
    confirmLifestyle,
    confirmAndApplyPlan,
    goBack,
    submitRegenerateFeedback,
    rentAdjustHint,
    onClose,
    baseCurrency: settings.baseCurrency,
  }
}

export type BuddgyBuilderApi = ReturnType<typeof useBuddgyBuilderFlow>
