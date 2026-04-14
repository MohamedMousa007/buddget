'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  computeDebtPaymentRecord,
  convertPaymentToDebtUnit,
  isDebtFullyPaid,
  type DebtBalanceContext,
} from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  buildFiatCurrencyPickerOptions,
  clampFiatToAllowed,
} from '@/lib/utils/currencyPickerOptions'
import { selectedPayableDebtId } from '@/lib/debt/selectedPayableDebtId'
import type { Currency, DebtRecurringFrequency } from '@/lib/store/types'

export function useRecurringDebtPaymentSheet() {
  const {
    addRecurringDebtPayment,
    debts,
    debtPayments,
    expenses,
    paymentMethods,
    settings,
    exchangeRates,
    goldPricePerGram,
  } = useFinanceStore(
    useShallow((s) => ({
      addRecurringDebtPayment: s.addRecurringDebtPayment,
      debts: s.debts,
      debtPayments: s.debtPayments,
      expenses: s.expenses,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
    }))
  )
  const { activeModal, setActiveModal } = useSettingsStore()
  const isOpen = activeModal === 'addRecurringDebtPayment'

  const debtBalanceCtx: DebtBalanceContext | undefined = useMemo(
    () => ({ expenses, exchangeRates, allDebts: debts }),
    [expenses, exchangeRates, debts]
  )

  const payableDebts = useMemo(
    () => debts.filter((d) => !isDebtFullyPaid(d, debtPayments, debtBalanceCtx)),
    [debts, debtPayments, debtBalanceCtx]
  )

  const [selectedDebtId, setSelectedDebtId] = useState(payableDebts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState<string>(settings.baseCurrency)
  const [frequency, setFrequency] = useState<DebtRecurringFrequency>('monthly')
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const prevIsOpen = useRef(false)

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setPaymentCurrency(settings.baseCurrency)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency])

  const resetForm = useCallback(() => {
    setAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setFrequency('monthly')
    setNextDueDate(new Date().toISOString().slice(0, 10))
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setIsActive(true)
    setNotes('')
    setError('')
  }, [paymentMethods, settings.baseCurrency])

  const close = useCallback(() => {
    resetForm()
    setActiveModal(null)
  }, [resetForm, setActiveModal])

  useEffect(() => {
    if (!isOpen) return
    /* eslint-disable react-hooks/set-state-in-effect -- reset defaults when opening */
    if (payableDebts.length > 0) {
      const sel = debts.find((d) => d.id === selectedDebtId)
      if (!sel || isDebtFullyPaid(sel, debtPayments, debtBalanceCtx)) {
        setSelectedDebtId(payableDebts[0].id)
      }
    }
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, payableDebts, debts, debtPayments, debtBalanceCtx, selectedDebtId, paymentMethods])

  const handleSubmit = useCallback(() => {
    if (!selectedDebtId || !selectedDebt || !amount) return
    const n = parseFloat(amount)
    if (Number.isNaN(n) || n <= 0) return

    setError('')
    const payCur =
      paymentCurrency === 'XAU' && selectedDebt.isGold
        ? 'XAU'
        : clampFiatToAllowed(settings, paymentCurrency as Currency)

    const check = computeDebtPaymentRecord(
      selectedDebt,
      n,
      payCur,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram,
      debtPayments,
      debtBalanceCtx
    )
    if (!check.ok) {
      setError(check.error)
      return
    }

    addRecurringDebtPayment({
      debtId: selectedDebtId,
      amount: n,
      currency: payCur as Currency,
      paymentMethodId: paymentMethodId || paymentMethods[0]?.id || '',
      frequency,
      nextDueDate,
      isActive,
      notes: notes || undefined,
    })
    close()
  }, [
    addRecurringDebtPayment,
    amount,
    close,
    debtBalanceCtx,
    debtPayments,
    exchangeRates,
    frequency,
    goldPricePerGram,
    isActive,
    nextDueDate,
    notes,
    paymentCurrency,
    paymentMethodId,
    paymentMethods,
    selectedDebt,
    selectedDebtId,
    settings,
  ])

  const previewLine = useMemo(() => {
    if (!amount || !selectedDebt) return null
    const n = parseFloat(amount)
    if (Number.isNaN(n) || n <= 0) return null
    if (selectedDebt.isGold && paymentCurrency !== 'XAU') {
      const grams = convertPaymentToDebtUnit(
        n,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${grams.toFixed(2)}g of ${selectedDebt.goldKarat || 24}K gold`
    }
    if (!selectedDebt.isGold && paymentCurrency !== selectedDebt.currency) {
      const converted = convertPaymentToDebtUnit(
        n,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${formatCurrency(converted, selectedDebt.currency)}`
    }
    return null
  }, [amount, exchangeRates, goldPricePerGram, paymentCurrency, selectedDebt, settings.baseCurrency])

  const selectDebtValue = selectedPayableDebtId(payableDebts, selectedDebtId)
  const fiatOptions = useMemo(() => buildFiatCurrencyPickerOptions(settings), [settings])

  return {
    isOpen,
    close,
    payableDebts,
    selectDebtValue,
    selectedDebtId,
    setSelectedDebtId,
    amount,
    setAmount,
    paymentCurrency,
    setPaymentCurrency,
    fiatOptions,
    frequency,
    setFrequency,
    nextDueDate,
    setNextDueDate,
    paymentMethodId,
    setPaymentMethodId,
    paymentMethods,
    isActive,
    setIsActive,
    notes,
    setNotes,
    error,
    setError,
    selectedDebt,
    handleSubmit,
    previewLine,
  }
}
