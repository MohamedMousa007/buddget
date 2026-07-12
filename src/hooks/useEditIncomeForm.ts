'use client'

import { useState, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { deriveDefaultPaydays } from '@/lib/utils/paydaySchedule'
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
  const [recurringFrequency, setRecurringFrequencyState] = useState<IncomeRecurringFrequency>(
    source.recurringFrequency ?? 'monthly'
  )
  const [paydayDays, setPaydayDays] = useState<number[]>(
    source.paydayDays?.length
      ? [...source.paydayDays].sort((a, b) => a - b)
      : deriveDefaultPaydays(source.dayOfMonth ?? 1, source.recurringFrequency ?? 'monthly')
  )
  const setRecurringFrequency = useCallback(
    (freq: IncomeRecurringFrequency) => {
      setRecurringFrequencyState(freq)
      setPaydayDays((days) => deriveDefaultPaydays(days[0] ?? source.dayOfMonth ?? 1, freq))
    },
    [source.dayOfMonth]
  )
  const [notes, setNotes] = useState(source.notes || '')
  const [paymentMethodId, setPaymentMethodId] = useState(source.paymentMethodId ?? '')
  const [effectiveStart, setEffectiveStart] = useState(source.effectiveStart)
  const [effectiveEnd, setEffectiveEnd] = useState(source.effectiveEnd ?? '')

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
      dayOfMonth: isRecurring ? paydayDays[0] ?? 1 : undefined,
      paydayDays: isRecurring && recurringFrequency !== 'monthly' && paydayDays.length ? paydayDays : undefined,
      notes: notes || undefined,
      effectiveStart: effectiveStart || source.effectiveStart,
      effectiveEnd: effectiveEnd || null,
      paymentMethodId: paymentMethodId || undefined,
      ...(typeLocked ? {} : { sourceType }),
    })
    onClose()
  }, [
    amount,
    currency,
    paydayDays,
    effectiveEnd,
    effectiveStart,
    isRecurring,
    name,
    notes,
    onClose,
    paymentMethodId,
    recurringFrequency,
    settings,
    source.effectiveStart,
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
    paydayDays,
    setPaydayDays,
    notes,
    setNotes,
    paymentMethodId,
    setPaymentMethodId,
    effectiveStart,
    setEffectiveStart,
    effectiveEnd,
    setEffectiveEnd,
    handleSubmit,
    baseCurrency: settings.baseCurrency,
  }
}
