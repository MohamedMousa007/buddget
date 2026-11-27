'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import { defaultGoalName } from '@/lib/goals/defaultGoalCopy'
import { useT } from '@/lib/i18n'
import type { ParsedGoal } from '@/lib/goals/goalAi'
import { addMonthsIso, computePace, defaultSharePct, monthsUntil, sharesOverFull } from '@/lib/goals/goalPlan'
import { averageMonthlySpend, fieldAdvice } from '@/lib/goals/fieldAdvice'
import { trackedDebtIds } from '@/lib/goals/debtGoal'
import { clearDraft, loadDraft, saveDraft, type NewGoalDraft } from '@/lib/goals/newGoalDraft'
import { createGoalPocket, ELSEWHERE, goalHomeAccounts, savedHomeProblem, savedPocketProblem, type SavedSourceKind } from '@/lib/goals/goalPocket'
import { isGoalIconKey, type GoalIconKey } from '@/lib/goals/goalVisual'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { computeBalances } from '@/lib/accounts/balance'
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
  const cat = useT().catalogs
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
  const [name, setName] = useState(draft?.name ?? (seed?.category ? defaultGoalName(seed.category, cat.goalNames) : ''))
  const [targetAmount, setTargetAmount] = useState(draft?.targetAmount ?? '')
  const [currency, setCurrency] = useState<Currency>((draft?.currency as Currency) ?? baseCcy)
  const [targetDate, setTargetDate] = useState(() =>
    draft?.targetDate && monthsUntil(now, draft.targetDate) >= 1 ? draft.targetDate : addMonthsIso(now, 12),
  )
  const [frequency, setFrequency] = useState(draft?.frequency ?? 'monthly')
  const [alreadySaved, setAlreadySaved] = useState(draft?.alreadySaved ?? '')
  const [savedHome, setSavedHome] = useState<string | null>(draft?.savedHome ?? null)
  // Add goal (version C): the saved money can also sit in another pocket, and a goal of your own picks its icon.
  const [savedPocketId, setSavedPocketId] = useState<string | null>(draft?.savedPocketId ?? null)
  const [savedKind, setSavedKind] = useState<SavedSourceKind>(draft?.savedPocketId ? 'pocket' : draft?.savedHome === ELSEWHERE ? 'outside' : 'account')
  const [icon, setIcon] = useState<GoalIconKey | null>(isGoalIconKey(draft?.icon) ? draft.icon : null)
  const [fundingMode, setFundingMode] = useState(draft?.fundingMode ?? 'share')
  const [sharePicked, setSharePicked] = useState<number | null>(draft?.sharePct ?? null)
  const [fixedAmount, setFixedAmount] = useState(draft?.fixedAmount ?? '')
  const [limit, setLimit] = useState(draft?.monthlySpendingLimit ?? '')
  const [spendingCategory, setSpendingCategory] = useState(draft?.spendingCategory ?? '')
  const [linkedDebtIds, setLinkedDebtIds] = useState<string[]>(draft?.linkedDebtIds ?? [])
  const [saveError, setSaveError] = useState(false)
  const submitted = useRef(false)
  const submitOnce = useSubmitOnce()

  // "Where is this money?": the tracked accounts that could already contain the saved amount, in the goal's currency.
  const ledger = useLedgerInput()
  // The same list the validation reads, so a required answer always has its question on screen.
  const homeAccounts = useMemo(() => {
    const balances = computeBalances(ledger)
    return goalHomeAccounts(ledger.paymentMethods, currency).map((method) => ({ method, free: Math.max(0, balances.get(method.id)?.free ?? 0) }))
  }, [ledger, currency])
  const savedPocket = savedPocketId ? ledger.savingsAccounts.find((a) => a.id === savedPocketId) : undefined
  const savedProblem = savedPocketProblem(savedKind, savedPocketId, num(alreadySaved)) ?? (savedPocketId
    ? num(alreadySaved) > 0 && (!savedPocket || savedPocket.currency !== currency || num(alreadySaved) > savedPocket.currentBalance + balanceEpsilon(currency))
      ? 'over_available' as const
      : null
    : savedHomeProblem(ledger, currency, num(alreadySaved), savedHome))

  const activeDebts = useMemo(() => s.debts.filter((d) => d.status !== 'cleared'), [s.debts])
  const kind = goalKind(category)
  const basis = useMemo(() => fundingBasis(s, now), [s, now])
  const target = num(targetAmount)
  const usualKeep = basis.usualKeep === null ? null : convertCurrency(basis.usualKeep, s.settings.baseCurrency, currency, s.exchangeRates)
  const pace = useMemo(
    () => computePace({ target, saved: num(alreadySaved), targetDate, frequency, usualKeep, now }),
    [target, alreadySaved, targetDate, frequency, usualKeep, now],
  )

  // Until the user moves the slider, suggest the share that lands the goal on its date (a modest default when unknown).
  const othersShare = s.goals.filter((g) => g.status === 'active' && g.category !== 'spending_control' && g.category !== 'debt_freedom' && g.fundingMode === 'share').reduce((sum, g) => sum + (g.sharePct ?? 0), 0)
  const sharePct =
    sharePicked ?? (pace.ratio === null ? defaultSharePct(othersShare) : Math.min(Math.max(5, 100 - othersShare), Math.max(5, Math.ceil((pace.ratio * 100) / 5) * 5)))
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
        setName(preset === 'card' ? cat.creditCardGoalName : defaultGoalName(c, cat.goalNames))
      } else {
        setLinkedDebtIds([])
        setName(defaultGoalName(c, cat.goalNames))
      }
      setStep(2)
    },
    [freeDebts, cat],
  )

  /** Version C's category chips: switch the category, keeping what was typed; a default name follows the category. */
  const chooseCategory = useCallback(
    (c: GoalCategory) => {
      setName((n) => (!n.trim() || n === defaultGoalName(category, cat.goalNames) ? defaultGoalName(c, cat.goalNames) : n))
      setCategory(c)
      setLinkedDebtIds([])
    },
    [category, cat],
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
      step, category, name, targetAmount, currency, targetDate, frequency, alreadySaved, savedHome, savedPocketId, icon, fundingMode, sharePct: sharePicked,
      fixedAmount, monthlySpendingLimit: limit, spendingCategory, linkedDebtIds,
    })
  }, [step, category, name, targetAmount, currency, targetDate, frequency, alreadySaved, savedHome, savedPocketId, icon, fundingMode, sharePicked, fixedAmount, limit, spendingCategory, linkedDebtIds])

  const running = s.goals.filter((g) => g.status === 'active' && g.category !== 'spending_control' && g.category !== 'debt_freedom')
  const nextPriority = s.goals.reduce((m, g) => Math.max(m, g.priority + 1), 0)
  const otherShare = running.filter((g) => g.fundingMode === 'share').reduce((sum, g) => sum + (g.sharePct ?? 0), 0)

  const canNext2 =
    kind === 'limit' ? num(limit) > 0 : kind === 'debt' ? linkedDebtIds.length > 0 && debtsOwed > 0 : target > 0 && name.trim().length > 0 && !savedProblem && !(fundingMode === 'share' && sharesOverFull(otherShare, sharePct))

  const submit = useCallback(() => {
    if (kind === 'save' && savedProblem) return setStep(2)
    if (!submitOnce.claim()) return
    const st = useFinanceStore.getState()
    const goalName = name.trim() || defaultGoalName(category, cat.goalNames)
    // A debt goal's target is the debts' base-currency total, so it is always saved in the base currency.
    const ccy = clampFiatToAllowed(st.settings, kind === 'debt' ? st.settings.baseCurrency : currency)
    try {
      const common = {
        name: goalName,
        emoji: category === 'custom' && icon ? icon : emojiFor(category),
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
          // Only a fixed amount has a period; a share and "by hand" are checked monthly.
          frequency: fundingMode === 'fixed' ? frequency : 'monthly',
        })
        const made = createGoalPocket(st, {
          goalId, pocketName: cat.goalPocketName(goalName), goalName, currency: ccy, saved: num(alreadySaved),
          home: savedPocketId ? null : savedHome, ...(savedPocketId ? { fromPocketId: savedPocketId } : {}),
        })
        // The saved amount was refused (the account changed since the step was validated): never keep a goal showing 0.
        if (!made.savedRecorded) {
          st.deleteGoal(goalId)
          st.deleteSavingsAccount(made.pocketId)
          throw new Error('saved amount not recorded')
        }
      }
    } catch {
      submitOnce.release()
      setSaveError(true)
      return
    }
    submitted.current = true
    clearDraft()
    onDone()
  }, [name, category, icon, currency, nextPriority, kind, limit, spendingCategory, target, debtsOwed, linkedDebtIds, alreadySaved, savedHome, savedPocketId, savedProblem, targetDate, fundingMode, sharePct, fixedAmount, frequency, onDone, cat, submitOnce])

  return {
    now, step, setStep, category, pickCategory, kind, name, setName, targetAmount, setTargetAmount,
    currency, setCurrency: (c: Currency) => setCurrency(clampFiatToAllowed(s.settings, c)),
    targetDate, setTargetDate, frequency, setFrequency, alreadySaved, setAlreadySaved,
    savedHome, setSavedHome, homeAccounts, savedProblem, savedPocketId, setSavedPocketId, savedKind, setSavedKind, icon, setIcon, chooseCategory,
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
