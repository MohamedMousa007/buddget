'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GOAL_CATEGORIES } from '@/lib/constants/goalCategories'
import { defaultGoalName } from '@/lib/goals/defaultGoalCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  calculateDebtRemaining,
  calculateDebtRemainingInBaseCurrency,
  calculateMonthlyIncome,
} from '@/lib/utils/calculations'
import type {
  AppSettings,
  Currency,
  Debt,
  DebtPayment,
  Expense,
  Goal,
  GoalCategory,
  IncomeSource,
} from '@/lib/store/types'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'

function emojiForCategory(c: GoalCategory): string {
  return GOAL_CATEGORIES.find((x) => x.value === c)?.emoji ?? '✏️'
}

type StoreSlice = {
  settings: AppSettings
  exchangeRates: Record<string, number>
  incomeSources: IncomeSource[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  expenses: Expense[]
  goldPricePerGram: number
  goldPriceAvailable: boolean
}

function buildInitialFields(
  editingGoal: Goal | null,
  s: StoreSlice
): {
  step: 1 | 2
  category: GoalCategory
  name: string
  targetAmount: string
  currency: Currency
  targetDate: string
  monthlyContribution: string
  monthlySpendingLimit: string
  manualCurrentAmount: string
  linkedSavingsAccountIds: string[]
  linkedDebtIds: string[]
  priority: string
  notes: string
} {
  if (editingGoal) {
    return {
      step: 2,
      category: editingGoal.category,
      name: editingGoal.name,
      targetAmount:
        editingGoal.targetAmount !== null && editingGoal.targetAmount !== undefined
          ? String(editingGoal.targetAmount)
          : '',
      currency: editingGoal.currency,
      targetDate: editingGoal.targetDate ?? '',
      monthlyContribution:
        editingGoal.monthlyContribution !== null && editingGoal.monthlyContribution !== undefined
          ? String(editingGoal.monthlyContribution)
          : '',
      monthlySpendingLimit:
        editingGoal.monthlySpendingLimit !== null && editingGoal.monthlySpendingLimit !== undefined
          ? String(editingGoal.monthlySpendingLimit)
          : '',
      manualCurrentAmount: String(editingGoal.manualCurrentAmount ?? 0),
      linkedSavingsAccountIds: editingGoal.linkedSavingsAccountIds ?? [],
      linkedDebtIds: editingGoal.linkedDebtIds ?? [],
      priority: String(editingGoal.priority ?? 0),
      notes: editingGoal.notes ?? '',
    }
  }
  const cat: GoalCategory = 'house'
  return {
    step: 1,
    category: cat,
    name: defaultGoalName(cat),
    targetAmount: '',
    currency: clampFiatToAllowed(s.settings, s.settings.baseCurrency),
    targetDate: '',
    monthlyContribution: '',
    monthlySpendingLimit: '',
    manualCurrentAmount: '0',
    linkedSavingsAccountIds: [],
    linkedDebtIds: [],
    priority: '0',
    notes: '',
  }
}

/**
 * Add / edit goal form. Parent should remount with `key` when `editingGoal` identity changes so fields reinitialize.
 */
export function useAddGoalForm(editingGoal: Goal | null, onDone: () => void) {
  const {
    settings,
    exchangeRates,
    incomeSources,
    savingsAccounts,
    debts,
    debtPayments,
    expenses,
    goldPricePerGram,
    goldPriceAvailable,
    addGoal,
    updateGoal,
    addSavingsAccount,
  } = useFinanceStore(
    useShallow((st) => ({
      settings: st.settings,
      exchangeRates: st.exchangeRates,
      incomeSources: st.incomeSources,
      savingsAccounts: st.savingsAccounts,
      debts: st.debts,
      debtPayments: st.debtPayments,
      expenses: st.expenses,
      goldPricePerGram: st.goldPricePerGram,
      goldPriceAvailable: st.goldPriceAvailable,
      addGoal: st.addGoal,
      updateGoal: st.updateGoal,
      addSavingsAccount: st.addSavingsAccount,
    }))
  )

  const slice: StoreSlice = {
    settings,
    exchangeRates,
    incomeSources,
    debts,
    debtPayments,
    expenses,
    goldPricePerGram,
    goldPriceAvailable,
  }

  const init = buildInitialFields(editingGoal, slice)

  const [step, setStep] = useState<1 | 2>(init.step)
  const [category, setCategory] = useState<GoalCategory>(init.category)
  const [name, setName] = useState(init.name)
  const [targetAmount, setTargetAmount] = useState(init.targetAmount)
  const [currency, setCurrency] = useState<Currency>(init.currency)
  const [targetDate, setTargetDate] = useState(init.targetDate)
  const [monthlyContribution, setMonthlyContribution] = useState(init.monthlyContribution)
  const [monthlySpendingLimit, setMonthlySpendingLimit] = useState(init.monthlySpendingLimit)
  const [manualCurrentAmount, setManualCurrentAmount] = useState(init.manualCurrentAmount)
  const [linkedSavingsAccountIds, setLinkedSavingsAccountIds] = useState(init.linkedSavingsAccountIds)
  const [linkedDebtIds, setLinkedDebtIds] = useState(init.linkedDebtIds)
  const [priority, setPriority] = useState(init.priority)
  const [notes, setNotes] = useState(init.notes)
  const [newAccountName, setNewAccountName] = useState('')

  const resetForCategory = useCallback(
    (cat: GoalCategory, preserveName: boolean) => {
      setCategory(cat)
      if (!preserveName) setName(defaultGoalName(cat))
      setCurrency(clampFiatToAllowed(settings, settings.baseCurrency))
      const monthly = calculateMonthlyIncome(incomeSources, settings.baseCurrency, exchangeRates)
      if (cat === 'emergency_fund') {
        const six = monthly * 6
        setTargetAmount(six > 0 ? String(Math.round(six * 100) / 100) : '')
      } else if (cat === 'spending_control') {
        setTargetAmount('')
        setMonthlySpendingLimit('')
      } else if (cat === 'debt_freedom') {
        const active = debts.filter((d) => d.status !== 'cleared')
        setLinkedDebtIds(active.map((d) => d.id))
        const balanceCtx = { expenses, exchangeRates, allDebts: debts }
        let sumBase = 0
        for (const d of active) {
          const rem = calculateDebtRemaining(d, debtPayments, balanceCtx)
          sumBase += calculateDebtRemainingInBaseCurrency(
            rem,
            d,
            settings.baseCurrency,
            exchangeRates,
            goldPricePerGram,
            goldPriceAvailable
          )
        }
        setTargetAmount(sumBase > 0 ? String(Math.round(sumBase * 100) / 100) : '')
      } else {
        setLinkedDebtIds([])
        setTargetAmount('')
      }
    },
    [debts, debtPayments, expenses, exchangeRates, goldPriceAvailable, goldPricePerGram, incomeSources, settings]
  )

  const savingsOptions = useMemo(
    () =>
      savingsAccounts.filter(
        (a) => a.category === 'savings' || a.name.toLowerCase().includes('fund')
      ),
    [savingsAccounts]
  )

  const toggleSavingsLink = useCallback((id: string) => {
    setLinkedSavingsAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const toggleDebtLink = useCallback((id: string) => {
    setLinkedDebtIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const submit = useCallback(() => {
    const trimmedName = name.trim() || defaultGoalName(category)
    const ta =
      category === 'spending_control'
        ? null
        : (() => {
            const n = parseFloat(targetAmount)
            return Number.isFinite(n) && n >= 0 ? n : null
          })()
    const mc = parseFloat(monthlyContribution)
    const ms = parseFloat(monthlySpendingLimit)
    const man = parseFloat(manualCurrentAmount)
    const pr = parseInt(priority, 10)

    let extraAccountId: string | undefined
    if (newAccountName.trim()) {
      extraAccountId = addSavingsAccount({
        name: newAccountName.trim(),
        category: 'savings',
        type: 'bank',
        icon: SAVINGS_TYPE_ICONS.bank,
        currency: clampFiatToAllowed(settings, currency),
      })
    }

    const linkedSav =
      extraAccountId ? [...linkedSavingsAccountIds, extraAccountId] : linkedSavingsAccountIds

    const payload = {
      name: trimmedName,
      emoji: emojiForCategory(category),
      category,
      targetAmount: ta,
      currency: clampFiatToAllowed(settings, currency),
      targetDate: targetDate.trim() || null,
      monthlyContribution: Number.isFinite(mc) && mc > 0 ? mc : null,
      monthlySpendingLimit:
        category === 'spending_control' && Number.isFinite(ms) && ms > 0 ? ms : null,
      manualCurrentAmount: Number.isFinite(man) ? man : 0,
      linkedSavingsAccountIds: linkedSav,
      linkedDebtIds: category === 'debt_freedom' ? linkedDebtIds : [],
      priority: Number.isFinite(pr) ? pr : 0,
      notes: notes.trim() || null,
      status: 'active' as const,
    }

    if (editingGoal) {
      updateGoal(editingGoal.id, payload)
    } else {
      addGoal(payload)
    }
    setStep(1)
    setNewAccountName('')
    onDone()
  }, [
    addGoal,
    addSavingsAccount,
    category,
    currency,
    editingGoal,
    linkedDebtIds,
    linkedSavingsAccountIds,
    manualCurrentAmount,
    monthlyContribution,
    monthlySpendingLimit,
    name,
    newAccountName,
    notes,
    onDone,
    priority,
    settings,
    targetAmount,
    targetDate,
    updateGoal,
  ])

  const pickCategory = useCallback(
    (c: GoalCategory) => {
      resetForCategory(c, false)
    },
    [resetForCategory]
  )

  const activeDebts = useMemo(() => debts.filter((d) => d.status !== 'cleared'), [debts])

  return {
    step,
    setStep,
    category,
    pickCategory,
    name,
    setName,
    targetAmount,
    setTargetAmount,
    currency,
    setCurrency: (c: Currency) => setCurrency(clampFiatToAllowed(settings, c)),
    targetDate,
    setTargetDate,
    monthlyContribution,
    setMonthlyContribution,
    monthlySpendingLimit,
    setMonthlySpendingLimit,
    manualCurrentAmount,
    setManualCurrentAmount,
    linkedSavingsAccountIds,
    linkedDebtIds,
    toggleSavingsLink,
    toggleDebtLink,
    priority,
    setPriority,
    notes,
    setNotes,
    newAccountName,
    setNewAccountName,
    savingsOptions,
    activeDebts,
    settings,
    resetForCategory,
    submit,
  }
}
