'use client'

import { useState, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type {
  Currency,
  IncomeRecurringFrequency,
  IncomeSource,
  IncomeSourceType,
} from '@/lib/store/types'

function isIncomeSourceTypeLocked(source: IncomeSource): boolean {
  if (source.linkedDebtId) return true
  if (
    source.linkedSavingsAccountId &&
    (source.sourceType === 'savings' || source.sourceType === 'investment')
  ) {
    return true
  }
  return false
}

/**
 * Local state + submit handler for editing an income row; respects read-only types for linked rows.
 */
export function useEditIncomeForm(source: IncomeSource, onClose: () => void) {
  const { updateIncomeSource, settings } = useFinanceStore()

  const [name, setName] = useState(source.name)
  const [amount, setAmount] = useState(source.amount.toString())
  const [currency, setCurrency] = useState<Currency>(source.currency)
  const [sourceType, setSourceType] = useState<IncomeSourceType>(source.sourceType ?? 'other')
  const [isRecurring, setIsRecurring] = useState(source.isRecurring)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>(
    source.recurringFrequency ?? 'monthly'
  )
  const [dayOfMonth, setDayOfMonth] = useState(String(source.dayOfMonth ?? 1))
  const [notes, setNotes] = useState(source.notes || '')

  const typeLocked = isIncomeSourceTypeLocked(source)

  const handleSubmit = useCallback(() => {
    if (!name || !amount || parseFloat(amount) <= 0) return
    const cur = clampFiatToAllowed(settings, currency)
    updateIncomeSource(source.id, {
      name,
      amount: parseFloat(amount),
      currency: cur,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
      notes: notes || undefined,
      ...(typeLocked ? {} : { sourceType }),
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
    sourceType,
    typeLocked,
    updateIncomeSource,
  ])

  return {
    name,
    setName,
    amount,
    setAmount,
    currency,
    setCurrency,
    sourceType,
    setSourceType,
    typeLocked,
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
