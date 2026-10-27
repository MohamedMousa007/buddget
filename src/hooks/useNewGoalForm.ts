'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { defaultGoalName } from '@/lib/goals/defaultGoalCopy'
import type { ParsedGoal } from '@/lib/goals/goalAi'
import { addMonthsIso, computePace, monthsUntil } from '@/lib/goals/goalPlan'
import { averageMonthlySpend, fieldAdvice } from '@/lib/goals/fieldAdvice'
import { trackedDebtIds } from '@/lib/goals/debtGoal'
import { clearDraft, loadDraft, saveDraft, type NewGoalDraft } from '@/lib/goals/newGoalDraft'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  calculateDebtRemaining,
  calculateDebtRemainingInBaseCurrency,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, ExpenseCategory, GoalCategory } from '@/lib/store/types'

export type GoalKind = 'save' | 'debt' | 'limit'
export const goalKind = (c: GoalCategory): GoalKind =>
  c === 'debt_freedom' ? 'debt' : c === 'spending_control' ? 'limit' : 'save'

export interface FlowSeed {
  category?: GoalCategory
  text?: string
}

const emojiFor = (c: GoalCategory) => GOAL_CATEGORIES.find((x) => x.value === c)?.emoji ?? '✏️'
const num = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function useNewGoalForm(seed: FlowSeed | null, onDone: () => void) {
  const s = useFinanceStore(
    useShallow((st) => ({
      settings: st.settings,
      exchangeRates: st.exchangeRates,
      incomeEvents: st.incomeEvents,
      incomeSources: st.incomeSources,
      expenses: st.expenses,
      budgetCategories: st.budgetCategories,
      budgetPlans: st.budgetPlans, activeBudgetPlanId: st.activeBudgetPlanId,
      goals: st.goals,
      debts: st.debts,
      debtPayments: st.debtPayments,
      goldPricePerGram: st.goldPricePerGram,
      goldPriceAvailable: st.goldPriceAvailable,
    })),
  )
  const now = useMemo(() => new Date(), [])
  const baseCcy = clampFiatToAllowed(s.settings, s.settings.baseCurrency)

  const [draft] = useState<NewGoalDraft | null>(() => (seed?.category || seed?.text ? null : loadDraft()))
  const [step, setStep] = useState<1 | 2 | 3>(draft?.step ?? (seed?.category ? 2 : 1))
  const [category, setCategory] = useState<GoalCategory>(draft?.category ?? seed?.category ?? 'custom')
  const [name, setName] = useState(draft?.name ?? (seed?.category ? defaultGoalName(seed.category) : ''))
  const [targetAmount, setTargetAmount] = useState(draft?.targetAmount ?? '')
  const [currency, setCurrency] = useState<Currency>((draft?.currency as Currency) ?? baseCcy)
  const [targetDate, setTargetDate] = useState(() =>
    draft?.targetDate && monthsUntil(now, draft.targetDate) >= 1 ? draft.targetDate : addMonthsIso(now, 12),
  )
  const [frequency, setFrequency] = useState(draft?.frequency ?? 'monthly')
  const [alreadySaved, setAlreadySaved] = useState(draft?.alreadySaved ?? '')
  const [fundingMode, setFundingMode] = useState(draft?.fundingMode ?? 'share')
  const [sharePicked, setSharePicked] = useState<number | null>(draft?.sharePct ?? null)
  const [fixedAmount, setFixedAmount] = useState(draft?.fixedAmount ?? '')
  const [limit, setLimit] = useState(draft?.monthlySpendingLimit ?? '')
  const [spendingCategory, setSpendingCategory] = useState(draft?.spendingCategory ?? '')
  const [linkedDebtIds, setLinkedDebtIds] = useState<string[]>(draft?.linkedDebtIds ?? [])
  const [saveError, setSaveError] = useState(false)
  const submitted = useRef(false)

  const activeDebts = useMemo(() => s.debts.filter((d) => d.status !== 'cleared'), [s.debts])
  const kind = goalKind(category)
  const basis = useMemo(() => fundingBasis(s, now), [s, now])
  const target = num(targetAmount)
  const usualKeep = basis.usualKeep === null ? null : convertCurrency(basis.usualKeep, s.settings.baseCurrency, currency, s.exchangeRates)
  const pace = useMemo(
    () => computePace({ target, saved: num(alreadySaved), targetDate, frequency, usualKeep, now }),
    [target, alreadySaved, targetDate, frequency, usualKeep, now],
  )

  // Until the user moves the slider, suggest the share that lands the goal on its date (100% when unknown).
  const sharePct =
    sharePicked ?? (pace.ratio === null ? 100 : Math.min(100, Math.max(5, Math.ceil((pace.ratio * 100) / 5) * 5)))
  const setSharePct = setSharePicked

  const debtsOwed = useMemo(() => {
    const ctx = { expenses: s.expenses, exchangeRates: s.exchangeRates, allDebts: s.debts }
    return activeDebts
      .filter((d) => linkedDebtIds.includes(d.id))
      .reduce(
        (sum, d) =>
          sum +
          calculateDebtRemainingInBaseCurrency(
            calculateDebtRemaining(d, s.debtPayments, ctx),
            d,
            s.settings.baseCurrency,
            s.exchangeRates,
            s.goldPricePerGram,
            s.goldPriceAvailable,
          ),
        0,
      )
  }, [activeDebts, linkedDebtIds, s])

  const monthlySpend = useMemo(() => {
    const base = averageMonthlySpend(s.expenses, now, s.settings.baseCurrency, s.exchangeRates)
    return base === null ? null : convertCurrency(base, s.settings.baseCurrency, currency, s.exchangeRates)
  }, [s.expenses, s.settings.baseCurrency, s.exchangeRates, currency, now])
  const advice = fieldAdvice({ category, target, saved: num(alreadySaved), monthlySpendInCcy: monthlySpend })

  const tracked = useMemo(() => trackedDebtIds(s.goals), [s.goals])
  const freeDebts = useMemo(() => activeDebts.filter((d) => !tracked.has(d.id)), [activeDebts, tracked])
  // Debts a saving goal might really be about: owed by the user, not a revolving card, not already followed.
  const linkable = useMemo(
    () => freeDebts.filter((d) => d.debtType !== 'credit_card' && d.direction !== 'they_owe'),
    [freeDebts],
  )

  const pickCategory = useCallback(
    (c: GoalCategory, preset?: 'card' | 'debt') => {
      setCategory(c)
      setTargetAmount('')
      if (c === 'debt_freedom') {
        const pool = freeDebts.filter((d) => (preset === 'card' ? d.debtType === 'credit_card' : d.debtType !== 'credit_card'))
        setLinkedDebtIds(pool.map((d) => d.id))
        setName(preset === 'card' ? 'Credit card' : defaultGoalName(c))
      } else {
        setLinkedDebtIds([])
        setName(defaultGoalName(c))
      }
      setStep(2)
    },
    [freeDebts],
  )

  /** "Paying this off instead?": turn the goal into one that follows an existing debt, so nothing is duplicated. */
  const linkInstead = useCallback((debtId: string, debtName: string) => {
    setCategory('debt_freedom')
    setName(debtName)
    setTargetAmount('')
    setLinkedDebtIds([debtId])
  }, [])

  const toggleDebt = (id: string) =>
    setLinkedDebtIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  /** Buddgy's chat shaped (or reshaped) the goal: fill what it settled, keep the rest. */
  const applyDraft = useCallback((p: ParsedGoal) => {
    setCategory(p.category)
    setName(p.name)
    if (p.target) setTargetAmount(String(p.target))
    if (p.date) setTargetDate(p.date)
  }, [])

  useEffect(() => {
    if (submitted.current) return
    saveDraft({
      step, category, name, targetAmount, currency, targetDate, frequency, alreadySaved, fundingMode, sharePct: sharePicked,
      fixedAmount, monthlySpendingLimit: limit, spendingCategory, linkedDebtIds,
    })
  }, [step, category, name, targetAmount, currency, targetDate, frequency, alreadySaved, fundingMode, sharePicked, fixedAmount, limit, spendingCategory, linkedDebtIds])

  const running = s.goals.filter((g) => g.status === 'active' && g.category !== 'spending_control' && g.category !== 'debt_freedom')
  const nextPriority = s.goals.reduce((m, g) => Math.max(m, g.priority + 1), 0)
  const otherShare = running.filter((g) => g.fundingMode === 'share').reduce((sum, g) => sum + (g.sharePct ?? 0), 0)

  const canNext2 =
    kind === 'limit' ? num(limit) > 0 : kind === 'debt' ? linkedDebtIds.length > 0 && debtsOwed > 0 : target > 0 && name.trim().length > 0

  const submit = useCallback(() => {
    const st = useFinanceStore.getState()
    const goalName = name.trim() || defaultGoalName(category)
    // A debt goal's target is the debts' base-currency total, so it is always saved in the base currency.
    const ccy = clampFiatToAllowed(st.settings, kind === 'debt' ? st.settings.baseCurrency : currency)
    try {
      const common = {
        name: goalName,
        emoji: emojiFor(category),
        category,
        currency: ccy,
        priority: nextPriority,
        status: 'active' as const,
        notes: null,
      }
      if (kind === 'limit') {
        st.addGoal({
          ...common, targetAmount: null, targetDate: null, monthlyContribution: null,
          monthlySpendingLimit: num(limit),
          spendingCategory: spendingCategory ? (spendingCategory as ExpenseCategory) : null,
          linkedSavingsAccountIds: [], linkedDebtIds: [],
        })
      } else if (kind === 'debt') {
        st.addGoal({
          ...common, targetAmount: Math.round(debtsOwed * 100) / 100, targetDate: null, monthlyContribution: null, monthlySpendingLimit: null,
          linkedSavingsAccountIds: [], linkedDebtIds,
        })
      } else {
        const goalId = st.addGoal({
          ...common, targetAmount: target, targetDate, monthlySpendingLimit: null,
          linkedSavingsAccountIds: [], linkedDebtIds: [],
          fundingMode,
          sharePct: fundingMode === 'share' ? sharePct : null,
          monthlyContribution: fundingMode === 'fixed' && num(fixedAmount) > 0 ? num(fixedAmount) : null,
          frequency,
        })
        const pocketId = st.addSavingsAccount({ name: `${goalName} pocket`, category: 'savings', type: 'vault', currency: ccy })
        st.updateGoal(goalId, { linkedSavingsAccountIds: [pocketId] })
        if (num(alreadySaved) > 0) {
          st.depositToSavings(pocketId, num(alreadySaved), ccy, goalName, { mode: 'declare', source: 'goal_opening' })
        }
      }
    } catch {
      setSaveError(true)
      return
    }
    submitted.current = true
    clearDraft()
    onDone()
  }, [name, category, currency, nextPriority, kind, limit, spendingCategory, target, debtsOwed, linkedDebtIds, alreadySaved, targetDate, fundingMode, sharePct, fixedAmount, frequency, onDone])

  return {
    now, step, setStep, category, pickCategory, kind, name, setName, targetAmount, setTargetAmount,
    currency, setCurrency: (c: Currency) => setCurrency(clampFiatToAllowed(s.settings, c)),
    targetDate, setTargetDate, frequency, setFrequency, alreadySaved, setAlreadySaved,
    fundingMode, setFundingMode, sharePct, setSharePct, fixedAmount, setFixedAmount,
    limit, setLimit, spendingCategory, setSpendingCategory,
    advice, activeDebts, tracked, linkable, linkInstead, linkedDebtIds, toggleDebt, debtsOwed,
    saveError, applyDraft,
    basis, usualKeep, pace, running, otherShare, canNext2, submit,
    baseCurrency: s.settings.baseCurrency,
    convert: (n: number, from: Currency, to: Currency) => convertCurrency(n, from, to, s.exchangeRates),
    discard: () => { clearDraft() },
  }
}
