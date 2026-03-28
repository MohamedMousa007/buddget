'use client'

import { useState, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Expense, ExpenseCategory, Currency } from '@/lib/store/types'

export function useEditExpenseForm(expense: Expense, onClose: () => void) {
  const { updateExpense, paymentMethods, settings, exchangeRates } = useFinanceStore()

  const [date, setDate] = useState(expense.date)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(expense.amount.toString())
  const [currency, setCurrency] = useState<Currency>(expense.currency)
  const [category, setCategory] = useState<ExpenseCategory>(expense.category)
  const [paymentMethodId, setPaymentMethodId] = useState(expense.paymentMethodId)
  const [isRecurring, setIsRecurring] = useState(expense.isRecurring)
  const [notes, setNotes] = useState(expense.notes || '')
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = useCallback(() => {
    if (!description || !amount || parseFloat(amount) <= 0) return

    const parsedAmount = parseFloat(amount)
    const cur = clampFiatToAllowed(settings, currency)
    const amountInBase = tryConvertCurrency(parsedAmount, cur, settings.baseCurrency, exchangeRates)
    if (amountInBase === null) {
      setSubmitError(
        `No exchange rate from ${cur} to ${settings.baseCurrency}. Update rates in Settings or pick another currency.`
      )
      return
    }
    setSubmitError('')

    updateExpense(expense.id, {
      date,
      description,
      category,
      amount: parsedAmount,
      currency: cur,
      amountInBaseCurrency: amountInBase,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
    })

    onClose()
  }, [
    amount,
    category,
    currency,
    date,
    description,
    exchangeRates,
    expense.id,
    isRecurring,
    notes,
    onClose,
    paymentMethodId,
    settings,
    updateExpense,
  ])

  return {
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
