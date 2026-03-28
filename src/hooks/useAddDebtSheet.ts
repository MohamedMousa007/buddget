'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  convertPaymentToDebtUnit,
  computeDebtPaymentRecord,
  isDebtFullyPaid,
} from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { clampDebtFiatToAllowed, clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency, DebtCurrency, GoldKarat } from '@/lib/store/types'

/**
 * State and handlers for the add-debt / record-payment bottom sheet.
 */
export function useAddDebtSheet() {
  const store = useFinanceStore()
  const {
    addDebt,
    addDebtPayment,
    addExpense,
    debts,
    debtPayments,
    paymentMethods,
    settings,
    exchangeRates,
    goldPricePerGram,
  } = store
  const {
    activeModal,
    setActiveModal,
    debtSheetPaymentOnly,
    debtSheetPrefillDebtId,
    resetDebtSheetIntent,
  } = useSettingsStore()
  const isOpen = activeModal === 'addDebt'

  const [mode, setMode] = useState<'new' | 'payment'>('new')
  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>(
    () => useFinanceStore.getState().settings.baseCurrency as DebtCurrency
  )
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')

  const [selectedDebtId, setSelectedDebtId] = useState(debts[0]?.id || '')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState<string>(settings.baseCurrency)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [paymentRateError, setPaymentRateError] = useState('')
  const prevIsOpen = useRef(false)

  const payableDebts = useMemo(
    () => debts.filter((d) => !isDebtFullyPaid(d, debtPayments)),
    [debts, debtPayments]
  )

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)
  const selectedPayable = payableDebts.find((d) => d.id === selectedDebtId)

  const closeSheet = useCallback(() => {
    resetDebtSheetIntent()
    setActiveModal(null)
  }, [resetDebtSheetIntent, setActiveModal])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync selected debt when list loads or id is empty */
    if (debts.length > 0 && !selectedDebtId) {
      setSelectedDebtId(debts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [debts, selectedDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- keep payment target on a payable debt while sheet open */
    if (!isOpen) return
    if (mode !== 'payment' && !debtSheetPaymentOnly) return
    if (payableDebts.length === 0) return
    const sel = debts.find((d) => d.id === selectedDebtId)
    if (!sel || isDebtFullyPaid(sel, debtPayments)) {
      setSelectedDebtId(payableDebts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, mode, debtSheetPaymentOnly, debts, debtPayments, payableDebts, selectedDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setPaymentCurrency(settings.baseCurrency)
      if (!isGold) setCurrency(settings.baseCurrency as DebtCurrency)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, isGold])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- apply payment-only intent and defaults when sheet opens */
    if (!isOpen) return
    if (debtSheetPaymentOnly && debtSheetPrefillDebtId) {
      setMode('payment')
      setSelectedDebtId(debtSheetPrefillDebtId)
    } else if (!debtSheetPaymentOnly) {
      setMode('new')
    }
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debtSheetPaymentOnly, debtSheetPrefillDebtId, paymentMethods])

  const resetForm = useCallback(() => {
    setName('')
    setPerson('')
    setDescription('')
    setStartingBalance('')
    setCurrency(settings.baseCurrency as DebtCurrency)
    setIsGold(false)
    setNotes('')
    setPaymentAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setPaymentRateError('')
  }, [settings.baseCurrency])

  const handleAddDebt = useCallback(() => {
    if (!name || !person || !startingBalance) return
    addDebt({
      name,
      person,
      description: description || undefined,
      startingBalance: parseFloat(startingBalance),
      currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
      isGold,
      goldKarat: isGold ? goldKarat : undefined,
      notes: notes || undefined,
    })
    resetForm()
    closeSheet()
  }, [
    addDebt,
    closeSheet,
    currency,
    description,
    goldKarat,
    isGold,
    name,
    notes,
    person,
    resetForm,
    settings,
    startingBalance,
  ])

  const handleAddPayment = useCallback(() => {
    if (!selectedDebtId || !paymentAmount || !selectedDebt) return
    const amount = parseFloat(paymentAmount)
    if (Number.isNaN(amount) || amount <= 0) return
    setPaymentRateError('')
    const payCur =
      paymentCurrency === 'XAU' && selectedDebt.isGold
        ? 'XAU'
        : clampFiatToAllowed(settings, paymentCurrency as Currency)
    const computed = computeDebtPaymentRecord(
      selectedDebt,
      amount,
      payCur,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram,
      debtPayments
    )
    if (!computed.ok) {
      setPaymentRateError(computed.error)
      return
    }
    const { amountInDebtUnit, amountInBase, rateAtEntry } = computed
    addDebtPayment({
      debtId: selectedDebtId,
      date: paymentDate,
      amountPaid: amountInDebtUnit,
      paymentCurrency: payCur,
      originalAmount: amount,
      amountInPrimary: amountInBase,
      rateAtEntry,
      notes: paymentNotes || undefined,
    })
    const pmId = paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
    addExpense({
      date: paymentDate,
      description: `Debt payment – ${selectedDebt.person}`,
      category: 'Debt',
      amount,
      currency: payCur as Currency,
      paymentMethodId: pmId,
      isRecurring: false,
      notes: paymentNotes || undefined,
    })
    resetForm()
    closeSheet()
  }, [
    addDebtPayment,
    addExpense,
    closeSheet,
    debtPayments,
    exchangeRates,
    goldPricePerGram,
    paymentAmount,
    paymentCurrency,
    paymentDate,
    paymentMethodId,
    paymentMethods,
    paymentNotes,
    resetForm,
    selectedDebt,
    selectedDebtId,
    settings,
  ])

  const paymentPreview = useCallback(() => {
    if (!paymentAmount || !selectedDebt) return null
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return null
    if (selectedDebt.isGold && paymentCurrency !== 'XAU') {
      const gramsViaHelper = convertPaymentToDebtUnit(
        amount,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${gramsViaHelper.toFixed(2)}g of ${selectedDebt.goldKarat || 24}K gold`
    }
    if (!selectedDebt.isGold && paymentCurrency !== selectedDebt.currency) {
      const converted = convertPaymentToDebtUnit(
        amount,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${formatCurrency(converted, selectedDebt.currency)}`
    }
    return null
  }, [
    exchangeRates,
    goldPricePerGram,
    paymentAmount,
    paymentCurrency,
    selectedDebt,
    settings.baseCurrency,
  ])

  return {
    isOpen,
    closeSheet,
    debtSheetPaymentOnly,
    mode,
    setMode,
    name,
    setName,
    person,
    setPerson,
    description,
    setDescription,
    startingBalance,
    setStartingBalance,
    currency,
    setCurrency,
    isGold,
    setIsGold,
    goldKarat,
    setGoldKarat,
    notes,
    setNotes,
    selectedDebtId,
    setSelectedDebtId,
    paymentAmount,
    setPaymentAmount,
    paymentCurrency,
    setPaymentCurrency,
    paymentDate,
    setPaymentDate,
    paymentNotes,
    setPaymentNotes,
    paymentMethodId,
    setPaymentMethodId,
    paymentRateError,
    setPaymentRateError,
    payableDebts,
    selectedDebt,
    selectedPayable,
    paymentMethods,
    settings,
    handleAddDebt,
    handleAddPayment,
    paymentPreview,
  }
}
