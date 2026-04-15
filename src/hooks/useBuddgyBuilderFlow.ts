'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { parseBudgetInput, type ParsedBudgetInput } from '@/lib/ai/parseBudgetInput'
import { generateBudgetPlan, regenerateBudgetPlanWithAi, type GeneratedPlan } from '@/lib/ai/generateBudgetPlan'
import {
  computeBudgetFromChoices,
  isSavingsCategoryRow,
  type FoodFrequency,
  type TransportMode,
  type LifestyleTier,
  type HouseholdType,
  type BudgetCategoryRow,
} from '@/lib/budget/lifestyleMappings'
import {
  applyRegenerateTweak,
  type RegenerateTweak,
} from '@/lib/budget/buddgyBuilderRedistribution'
import { pushProfileFieldsToSupabase } from '@/lib/profile/pushProfileFieldsToSupabase'
import type { Currency } from '@/lib/store/types'

export type BuilderStep = 'describe' | 'confirm' | 'lifestyle' | 'plan' | 'applied'

export const BUDDGY_BUILDER_STEP_ORDER: BuilderStep[] = ['describe', 'confirm', 'lifestyle', 'plan', 'applied']

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

export type BuddgyBuilderLoadingKind = 'idle' | 'parse' | 'plan' | 'regen'

export interface BuddgyBuilderOpenOptions {
  initialDescribeText?: string
  knownIncome?: { amount: number; currency: Currency }
}

/**
 * Buddgy Builder: describe → confirm → lifestyle → plan preview → applied.
 * Parse, finalize tip, and regenerate use AI; projected savings = income − expenses.
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

  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [expenseBaseOverride, setExpenseBaseOverride] = useState<BudgetCategoryRow[] | null>(null)
  const [amountEdits, setAmountEdits] = useState<Record<string, number> | null>(null)

  const displayRowsRef = useRef<BudgetCategoryRow[]>([])

  const stepIndex = BUDDGY_BUILDER_STEP_ORDER.indexOf(step)
  const loading = loadingKind !== 'idle'

  const computedBudget = useMemo(() => {
    if (!lifestyle.food || !lifestyle.transport || !lifestyle.tier) return null
    return computeBudgetFromChoices({
      income: basics.income,
      currency: basics.currency,
      country: basics.country || null,
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
    setAmountEdits(null)
  }, [lifestyle.food, lifestyle.transport, lifestyle.tier])

  const rawExpenseBase = useMemo(
    () => expenseBaseOverride ?? computedBudget?.categories ?? [],
    [expenseBaseOverride, computedBudget]
  )

  const displayExpenseRows = useMemo(() => {
    const base = rawExpenseBase.filter((c) => !isSavingsCategoryRow(c))
    if (!amountEdits) return base
    return base.map((r) => ({ ...r, amount: amountEdits[r.name] ?? r.amount }))
  }, [rawExpenseBase, amountEdits])

  displayRowsRef.current = displayExpenseRows

  const totalPlannedExpenses = useMemo(
    () => displayExpenseRows.reduce((s, r) => s + r.amount, 0),
    [displayExpenseRows]
  )

  const projectedSavings = useMemo(
    () => basics.income - totalPlannedExpenses,
    [basics.income, totalPlannedExpenses]
  )

  const mergedLifestyleNotes = useMemo(() => {
    const parts = [parsed?.lifestyleNotes, ...extraAiContext].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(' | ') : null
  }, [parsed?.lifestyleNotes, extraAiContext])

  const submitDescription = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length < 10) return
      setLoadingKind('parse')
      setError(null)

      const parseOpts = {
        knownIncome:
          options?.knownIncome && options.knownIncome.amount > 0 ?
            { amount: options.knownIncome.amount, currency: options.knownIncome.currency }
          : undefined,
        preamble: undefined,
      }

      const applyParsed = (result: Awaited<ReturnType<typeof parseBudgetInput>>) => {
        setParsed(result)

        const VALID_CURRENCIES: Currency[] = ['AED', 'USD', 'EGP', 'EUR', 'GBP', 'SAR', 'XAU']
        const parsedCur = (result.income.currency ?? '').toUpperCase() as Currency
        const fromParse = VALID_CURRENCIES.includes(parsedCur) ? parsedCur : settings.baseCurrency
        const known = options?.knownIncome
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
          rentIncludesUtilities: result.rent.includesUtilities !== false,
        })

        setStep('confirm')
      }

      const handleParseError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (msg.includes('429') || msg.includes('Too many') || msg.includes('breather')) {
          setError('Buddgy is taking a breather — please wait a moment and try again.')
        } else if (msg.includes('503') || msg.includes('unavailable')) {
          setError('Buddgy AI is temporarily unavailable. You can set up your budget manually.')
        } else if (msg.includes('JSON') || msg.includes('parse')) {
          setError('Buddgy had trouble understanding that. Please try rephrasing or try again.')
        } else {
          setError('Could not process your input. Try again.')
        }
        if (process.env.NODE_ENV === 'development') {
          console.warn('[BuddgyBuilder] parse failed:', msg)
        }
      }

      try {
        const result = await parseBudgetInput(trimmed, parseOpts)
        applyParsed(result)
      } catch (firstErr) {
        try {
          const retry = await parseBudgetInput(
            `IMPORTANT: Return ONLY a JSON object, no explanation.\n\n${trimmed}`,
            parseOpts
          )
          applyParsed(retry)
        } catch (retryErr) {
          handleParseError(retryErr ?? firstErr)
        }
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
    setStep('plan')
  }, [lifestyle])

  const beginAmountEdits = useCallback(() => {
    const base = displayRowsRef.current
    setAmountEdits(Object.fromEntries(base.map((r) => [r.name, r.amount])))
  }, [])

  const clearAmountEdits = useCallback(() => setAmountEdits(null), [])

  const setRowAmount = useCallback((name: string, amount: number) => {
    setAmountEdits((prev) => {
      const base = displayRowsRef.current
      const next = { ...(prev ?? Object.fromEntries(base.map((r) => [r.name, r.amount]))) }
      next[name] = Math.max(0, amount)
      return next
    })
  }, [])

  const applyCategoriesToStore = useCallback(
    (cats: BudgetCategoryRow[]) => {
      const cur = basics.currency
      const expenseOnly = cats.filter((c) => !isSavingsCategoryRow(c))
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
        expenseOnly.map((c) => ({
          id: crypto.randomUUID(),
          name: c.name,
          icon: c.emoji,
          amount: c.amount,
          currency: basics.currency,
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
    const rows = displayRowsRef.current.filter((c) => !isSavingsCategoryRow(c))
    if (rows.length === 0 || basics.income <= 0) return
    setLoadingKind('plan')
    setError(null)
    try {
      const result = await generateBudgetPlan({
        income: basics.income,
        currency: basics.currency,
        city: basics.city || 'Unknown',
        household: basics.household,
        lifestyleNotes: mergedLifestyleNotes,
        categories: rows,
      })

      setPlan(result)
      applyCategoriesToStore(result.categories)
      setStep('applied')
    } catch {
      setError('Could not finalize your plan. Try again.')
    } finally {
      setLoadingKind('idle')
    }
  }, [basics, mergedLifestyleNotes, applyCategoriesToStore])

  const goBack = useCallback(() => {
    setError(null)
    if (step === 'confirm') setStep('describe')
    else if (step === 'lifestyle') setStep('confirm')
    else if (step === 'plan') setStep('lifestyle')
  }, [step])

  const regeneratePlan = useCallback(
    async (tweak: RegenerateTweak, customNote: string | null) => {
      if (regenCount >= 3) return
      const baseRows = displayRowsRef.current.filter((c) => !isSavingsCategoryRow(c))
      if (baseRows.length === 0) return

      setAmountEdits(null)
      setLoadingKind('regen')
      setError(null)
      setRentAdjustHint(null)

      const { rows: tweakedRows, noteForAi, rentNote } = applyRegenerateTweak(
        rawExpenseBase.filter((c) => !isSavingsCategoryRow(c)),
        tweak,
        customNote
      )
      const feedbackParts = [
        tweak === 'more_savings' && 'User wants to save more; reduce discretionary spending.',
        tweak === 'better_lifestyle' && 'User wants a better lifestyle; increase dining and entertainment where possible.',
        tweak === 'lower_rent' && 'User asked about lower rent (rent is fixed from basics step).',
        tweak === 'less_dining' && 'User wants less dining out.',
        tweak === 'something_else' && customNote?.trim(),
        noteForAi,
      ].filter(Boolean) as string[]
      const feedback = feedbackParts.join(' ')

      try {
        const next = await regenerateBudgetPlanWithAi({
          categories: baseRows,
          income: basics.income,
          currency: basics.currency,
          city: basics.city || '',
          country: basics.country || null,
          household: basics.household,
          feedback,
        })
        setExpenseBaseOverride(next)
        if (noteForAi) setExtraAiContext((prev) => [...prev, noteForAi])
        if (rentNote) setRentAdjustHint(rentNote)
      } catch {
        setExpenseBaseOverride(tweakedRows)
        if (noteForAi) setExtraAiContext((prev) => [...prev, noteForAi])
        if (rentNote) setRentAdjustHint(rentNote)
        setError('AI could not reshape the plan; applied a quick local adjustment instead.')
      } finally {
        setLoadingKind('idle')
        setRegenCount((c) => c + 1)
      }
    },
    [regenCount, rawExpenseBase, basics]
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
    projectedSavings,
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
    regeneratePlan,
    rentAdjustHint,
    onClose,
    baseCurrency: settings.baseCurrency,
    editingAmounts: amountEdits !== null,
    beginAmountEdits,
    clearAmountEdits,
    setRowAmount,
  }
}

export type BuddgyBuilderApi = ReturnType<typeof useBuddgyBuilderFlow>
