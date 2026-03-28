'use client'

import { useState, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

export function useEditIncomeForm(source: IncomeSource, onClose: () => void) {
  const { updateIncomeSource, settings } = useFinanceStore()

  const [name, setName] = useState(source.name)
  const [amount, setAmount] = useState(source.amount.toString())
  const [currency, setCurrency] = useState<Currency>(source.currency)
  const [isRecurring, setIsRecurring] = useState(source.isRecurring)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>(
    source.recurringFrequency ?? 'monthly'
  )
  const [dayOfMonth, setDayOfMonth] = useState(String(source.dayOfMonth ?? 1))
  const [notes, setNotes] = useState(source.notes || '')

  const handleSubmit = useCallback(() => {
    if (!name || !amount || parseFloat(amount) <= 0) return
    updateIncomeSource(source.id, {
      name,
      amount: parseFloat(amount),
      currency: clampFiatToAllowed(settings, currency),
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
      notes: notes || undefined,
    })
    onClose()
  }, [
    amount,
    currency,
    dayOfMonth,
    isRecurring,
    name,
    notes,
    onClose,
    recurringFrequency,
    settings,
    source.id,
    updateIncomeSource,
  ])

  return {
    name,
    setName,
    amount,
    setAmount,
    currency,
    setCurrency,
    isRecurring,
    setIsRecurring,
    recurringFrequency,
    setRecurringFrequency,
    dayOfMonth,
    setDayOfMonth,
    notes,
    setNotes,
    handleSubmit,
    baseCurrency: settings.baseCurrency,
  }
}
