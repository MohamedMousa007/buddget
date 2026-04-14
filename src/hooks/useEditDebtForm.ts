'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampDebtFiatToAllowed, clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { calculateDebtRemaining, isDebtFullyPaid, type DebtBalanceContext } from '@/lib/utils/calculations'
import type { Currency, Debt, DebtCurrency, DebtGoal, GoldKarat } from '@/lib/store/types'

function goalFrequencyToRecurring(
  f: DebtGoal['paymentFrequency']
): import('@/lib/store/types').DebtRecurringFrequency {
  return f
}

export function useEditDebtForm(debt: Debt | undefined, isOpen: boolean) {
  const t = useT()
  const {
    updateDebt,
    deleteDebt,
    settings,
    debtPayments,
    expenses,
    debts,
    exchangeRates,
    recurringDebtPayments,
    paymentMethods,
    addRecurringDebtPayment,
    updateRecurringDebtPayment,
    deleteRecurringDebtPayment,
  } = useFinanceStore(
    useShallow((s) => ({
      updateDebt: s.updateDebt,
      deleteDebt: s.deleteDebt,
      settings: s.settings,
      debtPayments: s.debtPayments,
      expenses: s.expenses,
      debts: s.debts,
      exchangeRates: s.exchangeRates,
      recurringDebtPayments: s.recurringDebtPayments,
      paymentMethods: s.paymentMethods,
      addRecurringDebtPayment: s.addRecurringDebtPayment,
      updateRecurringDebtPayment: s.updateRecurringDebtPayment,
      deleteRecurringDebtPayment: s.deleteRecurringDebtPayment,
    }))
  )

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>('EGP')
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate form when editing debt opens */
    if (isOpen && debt) {
      setName(debt.name)
      setPerson(debt.person)
      setDescription(debt.description || '')
      setCurrency(debt.currency)
      setIsGold(debt.isGold)
      setGoldKarat(debt.goldKarat || 24)
      setNotes(debt.notes || '')
      setGoalSheetOpen(false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debt])

  const paymentsForDebt = useMemo(
    () => (debt ? debtPayments.filter((p) => p.debtId === debt.id) : []),
    [debt, debtPayments]
  )

  const debtBalanceCtx: DebtBalanceContext | undefined = useMemo(
    () => ({ expenses, exchangeRates, allDebts: debts }),
    [expenses, exchangeRates, debts]
  )

  const remainingForGoal = useMemo(() => {
    if (!debt) return 0
    return calculateDebtRemaining(debt, paymentsForDebt, debtBalanceCtx)
  }, [debt, paymentsForDebt, debtBalanceCtx])

  const paidOff = useMemo(
    () => (debt ? isDebtFullyPaid(debt, paymentsForDebt, debtBalanceCtx) : false),
    [debt, paymentsForDebt, debtBalanceCtx]
  )

  const recurringForDebt = useMemo(
    () => (debt ? recurringDebtPayments.find((r) => r.debtId === debt.id) : undefined),
    [debt, recurringDebtPayments]
  )

  const handleGoalSave = useCallback(
    (goal: DebtGoal, remindRecurring: boolean) => {
      if (!debt) return
      updateDebt(debt.id, { goal })

      const pmId = paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
      const payCur = debt.isGold ? 'XAU' : clampFiatToAllowed(settings, debt.currency as Currency)
      const existing = useFinanceStore.getState().recurringDebtPayments.find((r) => r.debtId === debt.id)

      if (remindRecurring) {
        if (existing) {
          updateRecurringDebtPayment(existing.id, {
            amount: goal.calculatedAmount,
            frequency: goalFrequencyToRecurring(goal.paymentFrequency),
            nextDueDate: format(new Date(), 'yyyy-MM-dd'),
            isActive: true,
          })
        } else {
          addRecurringDebtPayment({
            debtId: debt.id,
            amount: goal.calculatedAmount,
            currency: payCur,
            frequency: goalFrequencyToRecurring(goal.paymentFrequency),
            nextDueDate: format(new Date(), 'yyyy-MM-dd'),
            paymentMethodId: pmId,
            isActive: true,
            notes: 'Payoff goal',
          })
        }
      } else if (existing) {
        deleteRecurringDebtPayment(existing.id)
      }
    },
    [
      addRecurringDebtPayment,
      deleteRecurringDebtPayment,
      debt,
      paymentMethods,
      settings,
      updateDebt,
      updateRecurringDebtPayment,
    ]
  )

  const handleRemoveGoal = useCallback(() => {
    if (!debt) return
    if (!window.confirm(t.debts.confirmRemoveGoal)) return
    updateDebt(debt.id, { goal: undefined })
    const existing = useFinanceStore.getState().recurringDebtPayments.find((r) => r.debtId === debt.id)
    if (existing) {
      deleteRecurringDebtPayment(existing.id)
    }
  }, [debt, deleteRecurringDebtPayment, t.debts.confirmRemoveGoal, updateDebt])

  const handleSave = useCallback(
    (onAfter: () => void) => {
      if (!debt || !name || !person) return

      updateDebt(debt.id, {
        name,
        person,
        description: description || undefined,
        currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
        isGold,
        goldKarat: isGold ? goldKarat : undefined,
        notes: notes || undefined,
      })

      onAfter()
    },
    [currency, debt, description, goldKarat, isGold, name, notes, person, settings, updateDebt]
  )

  const handleDelete = useCallback(
    (onAfter: () => void) => {
      if (!debt) return
      if (window.confirm(t.common.confirmDeleteGeneric)) {
        deleteDebt(debt.id)
        onAfter()
      }
    },
    [debt, deleteDebt, t]
  )

  return {
    name,
    setName,
    person,
    setPerson,
    description,
    setDescription,
    currency,
    setCurrency,
    isGold,
    setIsGold,
    goldKarat,
    setGoldKarat,
    notes,
    setNotes,
    handleSave,
    handleDelete,
    goalSheetOpen,
    setGoalSheetOpen,
    remainingForGoal,
    recurringForDebt,
    handleGoalSave,
    handleRemoveGoal,
    paidOff,
  }
}
