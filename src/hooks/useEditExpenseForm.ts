'use client'

import { useState, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { usePlanCategories } from '@/hooks/usePlanCategories'
import type { Expense, Currency, SpendExclusion } from '@/lib/store/types'

export function useEditExpenseForm(expense: Expense, onClose: () => void) {
  const { updateExpense, paymentMethods, settings, exchangeRates } = useFinanceStore()
  const t = useT()
  const { categoryChipOptions } = usePlanCategories()

  const [date, setDate] = useState(expense.date)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(expense.amount.toString())
  const [currency, setCurrency] = useState<Currency>(expense.currency)
  const [category, setCategory] = useState<string>(expense.category)
  const [subcategory, setSubcategory] = useState<string | undefined>(expense.subcategory)
  const [paymentMethodId, setPaymentMethodId] = useState(expense.paymentMethodId)
  const [isRecurring, setIsRecurring] = useState(expense.isRecurring)
  const [notes, setNotes] = useState(expense.notes || '')
  const [spendExclusion, setSpendExclusion] = useState<SpendExclusion | undefined>(expense.spendExclusion)
  const [owedBy, setOwedBy] = useState(expense.owedBy ?? '')
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = useCallback(() => {
    if (!description || !amount || parseFloat(amount) <= 0) return

    const parsedAmount = parseFloat(amount)
    const cur = clampFiatToAllowed(settings, currency)
    const amountInBase = tryConvertCurrency(parsedAmount, cur, settings.baseCurrency, exchangeRates)
    if (amountInBase === null) {
      setSubmitError(
        `${t.common.tryAgain} — ${cur} → ${settings.baseCurrency}`
      )
      return
    }
    setSubmitError('')

    updateExpense(expense.id, {
      date,
      description,
      category,
      subcategory,
      amount: parsedAmount,
      currency: cur,
      amountInBaseCurrency: amountInBase,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
      spendExclusion,
      owedBy: spendExclusion === 'for_someone' ? owedBy.trim() || undefined : undefined,
      owedSettledAt: spendExclusion === 'for_someone' ? expense.owedSettledAt : undefined,
    })

    onClose()
  }, [
    amount,
    category,
    subcategory,
    currency,
    date,
    description,
    exchangeRates,
    expense.id,
    expense.owedSettledAt,
    spendExclusion,
    owedBy,
    isRecurring,
    notes,
    onClose,
    paymentMethodId,
    settings,
    t.common.tryAgain,
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
    subcategory,
    setSubcategory,
    categoryChipOptions,
    paymentMethodId,
    setPaymentMethodId,
    isRecurring,
    setIsRecurring,
    notes,
    setNotes,
    exclusion: { value: spendExclusion, setValue: setSpendExclusion, owedBy, setOwedBy },
    submitError,
    setSubmitError,
    paymentMethods,
    handleSubmit,
  }
}
