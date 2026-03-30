'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EXPENSE_ENTRY_CATEGORIES, EXPENSE_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { ExpenseCategory, Currency } from '@/lib/store/types'
import { matchPaymentMethodForExpense } from '@/lib/modals/matchPaymentMethodForExpense'

export function useAddExpenseSheet() {
  const { addExpense, paymentMethods, settings } = useFinanceStore()
  const { activeModal, setActiveModal, expensePrefill, setExpensePrefill } = useSettingsStore()
  const isOpen = activeModal === 'addExpense'

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [category, setCategory] = useState<ExpenseCategory>('Food')
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [isRecurring, setIsRecurring] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitError, setSubmitError] = useState('')
  const skipNextDefaultCurrencySync = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- apply AI/sheet prefill when opening */
    if (isOpen && expensePrefill) {
      skipNextDefaultCurrencySync.current = true
      if (expensePrefill.date) setDate(expensePrefill.date)
      if (expensePrefill.description) setDescription(expensePrefill.description)
      if (expensePrefill.amount) setAmount(expensePrefill.amount)
      if (expensePrefill.currency && FIAT_CURRENCIES.includes(expensePrefill.currency as Currency)) {
        setCurrency(clampFiatToAllowed(settings, expensePrefill.currency as Currency))
      }
      if (
        expensePrefill.category &&
        EXPENSE_ENTRY_CATEGORIES.includes(expensePrefill.category as ExpenseCategory)
      ) {
        setCategory(expensePrefill.category as ExpenseCategory)
      } else if (
        expensePrefill.category === 'Savings' &&
        EXPENSE_CATEGORIES.includes(expensePrefill.category as ExpenseCategory)
      ) {
        setCategory('Other')
      }
      if (expensePrefill.paymentMethod) {
        setPaymentMethodId(matchPaymentMethodForExpense(expensePrefill.paymentMethod, paymentMethods))
      }
      if (expensePrefill.notes) setNotes(expensePrefill.notes)
      setExpensePrefill(null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, expensePrefill, setExpensePrefill, paymentMethods, settings])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default currency when opening without AI prefill */
    if (!isOpen || expensePrefill) return
    if (skipNextDefaultCurrencySync.current) {
      skipNextDefaultCurrencySync.current = false
      return
    }
    setCurrency(settings.baseCurrency)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, expensePrefill, settings.baseCurrency])

  const resetForm = useCallback(() => {
    setDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setCategory('Food')
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setIsRecurring(false)
    setNotes('')
    setSubmitError('')
  }, [paymentMethods, settings.baseCurrency])

  const handleClose = useCallback(() => {
    setSubmitError('')
    resetForm()
    setExpensePrefill(null)
    setActiveModal(null)
  }, [resetForm, setActiveModal, setExpensePrefill])

  const handleSubmit = useCallback(() => {
    if (!description || !amount || parseFloat(amount) <= 0) return
    const parsedAmount = parseFloat(amount)
    setSubmitError('')
    const cur = clampFiatToAllowed(settings, currency)
    addExpense({
      date,
      description,
      category,
      amount: parsedAmount,
      currency: cur,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
    })
    resetForm()
    setActiveModal(null)
  }, [
    addExpense,
    amount,
    category,
    date,
    description,
    isRecurring,
    notes,
    paymentMethodId,
    resetForm,
    setActiveModal,
    settings,
    currency,
  ])

  return {
    isOpen,
    handleClose,
    date,
    setDate,
    description,
    setDescription,
    amount,
    setAmount,
    currency,
    setCurrency,
    category,
    setCategory,
    paymentMethodId,
    setPaymentMethodId,
    isRecurring,
    setIsRecurring,
    notes,
    setNotes,
    submitError,
    setSubmitError,
    paymentMethods,
    handleSubmit,
  }
}
