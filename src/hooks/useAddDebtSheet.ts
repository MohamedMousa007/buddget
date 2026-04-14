'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  convertPaymentToDebtUnit,
  computeDebtPaymentRecord,
  isDebtFullyPaid,
} from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { clampDebtFiatToAllowed, clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type {
  Currency,
  Debt,
  DebtCurrency,
  DebtGoal,
  DebtKind,
  DebtReceivedVia,
  DebtRecurringFrequency,
  GoldKarat,
} from '@/lib/store/types'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'

type NewDebtPayload = Omit<Debt, 'id' | 'createdAt'>

function isDebtListedAsActive(d: { status?: 'active' | 'cleared' }): boolean {
  return d.status !== 'cleared'
}

function mapGoalFreqToRecurring(f: DebtGoal['paymentFrequency']): DebtRecurringFrequency {
  return f
}

/**
 * State and handlers for the add-debt / record-payment bottom sheet.
 */
export function useAddDebtSheet() {
  const showToast = useActionToast()
  const tI18n = useT()
  const store = useFinanceStore()
  const {
    addDebt,
    addDebtPaymentWithExpense,
    addRecurringDebtPayment,
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
  const isPayDebtFlow = activeModal === 'payDebt'
  const isOpen = activeModal === 'addDebt' || activeModal === 'payDebt'

  const [payDebtStep, setPayDebtStep] = useState<'select' | 'form'>('select')
  const [mode, setMode] = useState<'new' | 'payment'>('new')
  const [debtType, setDebtType] = useState<DebtKind>('personal')
  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>(
    () => useFinanceStore.getState().settings.baseCurrency as DebtCurrency
  )
  const [receivedVia, setReceivedVia] = useState<DebtReceivedVia>('cash')
  const isGold = receivedVia === 'gold'
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')
  const [relationship, setRelationship] = useState('')
  const [direction, setDirection] = useState<'i_owe' | 'they_owe'>('i_owe')
  const [creditor, setCreditor] = useState('')
  const [installmentItemName, setInstallmentItemName] = useState('')
  const [installmentCount, setInstallmentCount] = useState('12')
  const [installmentFrequency, setInstallmentFrequency] = useState<
    'weekly' | 'monthly' | 'quarterly' | 'annually'
  >('monthly')
  const [installmentStartDate, setInstallmentStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [interestFree, setInterestFree] = useState(true)
  const [goalDraft, setGoalDraft] = useState<DebtGoal | null>(null)
  const [goalRemindRecurring, setGoalRemindRecurring] = useState(false)
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)

  const [selectedDebtId, setSelectedDebtId] = useState(debts[0]?.id || '')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState<string>(settings.baseCurrency)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [paymentRateError, setPaymentRateError] = useState('')
  const [paymentScheduleMode, setPaymentScheduleMode] = useState<'one_time' | 'recurring'>('one_time')
  const [recurringFrequency, setRecurringFrequency] = useState<DebtRecurringFrequency>('monthly')
  const prevIsOpen = useRef(false)

  const payableDebts = useMemo(
    () =>
      debts.filter(
        (d) => isDebtListedAsActive(d) && !isDebtFullyPaid(d, debtPayments)
      ),
    [debts, debtPayments]
  )

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)
  const selectedPayable = payableDebts.find((d) => d.id === selectedDebtId)

  const closeSheet = useCallback(() => {
    resetDebtSheetIntent()
    setActiveModal(null)
    setPayDebtStep('select')
    setGoalSheetOpen(false)
  }, [resetDebtSheetIntent, setActiveModal])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync selected debt when list loads or id is empty */
    if (debts.length > 0 && !selectedDebtId) {
      setSelectedDebtId(debts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [debts, selectedDebtId])

  useEffect(() => {
    if (!isOpen) return
    if (debtType === 'installment' && receivedVia === 'gold') {
      /* eslint-disable react-hooks/set-state-in-effect -- installment plans are fiat-only in this flow */
      setReceivedVia('cash')
      setCurrency(settings.baseCurrency as DebtCurrency)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [debtType, receivedVia, isOpen, settings.baseCurrency])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- keep payment target on a payable debt while sheet open */
    if (!isOpen) return
    if (mode !== 'payment' && !debtSheetPaymentOnly && !isPayDebtFlow) return
    if (payableDebts.length === 0) return
    const sel = debts.find((d) => d.id === selectedDebtId)
    if (!sel || isDebtFullyPaid(sel, debtPayments)) {
      setSelectedDebtId(payableDebts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, mode, debtSheetPaymentOnly, isPayDebtFlow, debts, debtPayments, payableDebts, selectedDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setPaymentCurrency(settings.baseCurrency)
      if (receivedVia !== 'gold') setCurrency(settings.baseCurrency as DebtCurrency)
      if (isPayDebtFlow) {
        setPayDebtStep('select')
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, receivedVia, isPayDebtFlow])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- apply payment-only intent and defaults when sheet opens */
    if (!isOpen) return
    if (debtSheetPaymentOnly && debtSheetPrefillDebtId) {
      setMode('payment')
      setSelectedDebtId(debtSheetPrefillDebtId)
    } else if (!debtSheetPaymentOnly && !isPayDebtFlow) {
      setMode('new')
    }
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debtSheetPaymentOnly, debtSheetPrefillDebtId, paymentMethods, isPayDebtFlow])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default payment currency to selected debt */
    if (!isOpen || mode !== 'payment') return
    const d = debts.find((x) => x.id === selectedDebtId)
    if (d && !d.isGold) {
      setPaymentCurrency(String(d.currency))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, mode, selectedDebtId, debts])

  const resetForm = useCallback(() => {
    setDebtType('personal')
    setName('')
    setPerson('')
    setDescription('')
    setStartingBalance('')
    setCurrency(settings.baseCurrency as DebtCurrency)
    setReceivedVia('cash')
    setNotes('')
    setRelationship('')
    setDirection('i_owe')
    setCreditor('')
    setInstallmentItemName('')
    setInstallmentCount('12')
    setInstallmentFrequency('monthly')
    setInstallmentStartDate(new Date().toISOString().slice(0, 10))
    setInterestFree(true)
    setGoalDraft(null)
    setGoalRemindRecurring(false)
    setGoalSheetOpen(false)
    setPaymentAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setPaymentRateError('')
    setPaymentScheduleMode('one_time')
    setRecurringFrequency('monthly')
  }, [settings.baseCurrency])

  const canSubmitNewDebt = useMemo(() => {
    const total = parseFloat(startingBalance)
    if (!startingBalance || Number.isNaN(total) || total <= 0) return false
    if (debtType === 'personal') return !!(name.trim() && person.trim())
    if (debtType === 'installment') {
      const n = parseInt(installmentCount, 10)
      return !!(installmentItemName.trim() && !Number.isNaN(n) && n > 0 && installmentStartDate)
    }
    return !!(name.trim() && person.trim())
  }, [
    debtType,
    installmentCount,
    installmentItemName,
    installmentStartDate,
    name,
    person,
    startingBalance,
  ])

  const handleAddDebt = useCallback(() => {
    if (!canSubmitNewDebt) return
    const total = parseFloat(startingBalance)
    const baseEmoji = isGold ? '🪙' : '💳'
    const payload: NewDebtPayload = {
      name: debtType === 'installment' ? installmentItemName.trim() : name.trim(),
      person:
        debtType === 'installment'
          ? 'Installment'
          : debtType === 'general'
            ? person.trim() || creditor.trim() || 'General'
            : person.trim(),
      description: description || undefined,
      startingBalance: total,
      currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
      isGold,
      goldKarat: isGold ? goldKarat : undefined,
      notes: notes || undefined,
      debtType,
      emoji: baseEmoji,
      status: 'active',
      receivedVia,
    }

    if (debtType === 'personal') {
      payload.relationship = relationship.trim() || undefined
      payload.direction = direction
      payload.personName = person.trim()
    }
    if (debtType === 'installment') {
      const n = Math.max(1, parseInt(installmentCount, 10) || 1)
      const per = interestFree ? total / n : total / n
      payload.installmentCount = n
      payload.installmentFrequency = installmentFrequency
      payload.startDate = installmentStartDate
      payload.interestFree = interestFree
      payload.installmentAmount = Math.round(per * 100) / 100
    }
    if (debtType === 'general') {
      payload.creditor = creditor.trim() || undefined
    }
    if (goalDraft) {
      payload.goal = goalDraft
    }

    const id = addDebt(payload)

    if (goalDraft && goalRemindRecurring) {
      const pmId =
        paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
      addRecurringDebtPayment({
        debtId: id,
        amount: goalDraft.calculatedAmount,
        currency: isGold ? 'XAU' : clampFiatToAllowed(settings, currency as Currency),
        frequency: mapGoalFreqToRecurring(goalDraft.paymentFrequency),
        nextDueDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethodId: pmId,
        isActive: true,
        notes: 'Payoff goal',
      })
    }

    showToast(tI18n.common.toastDebtAdded)
    resetForm()
    closeSheet()
  }, [
    addDebt,
    addRecurringDebtPayment,
    canSubmitNewDebt,
    closeSheet,
    creditor,
    currency,
    debtType,
    description,
    direction,
    goalDraft,
    goalRemindRecurring,
    installmentCount,
    installmentFrequency,
    installmentItemName,
    installmentStartDate,
    interestFree,
    isGold,
    receivedVia,
    name,
    notes,
    paymentMethods,
    person,
    relationship,
    resetForm,
    settings,
    startingBalance,
    goldKarat,
    showToast,
    tI18n,
  ])

  const handleAddPayment = useCallback(() => {
    if (!selectedDebtId || !selectedDebt) return
    const amount = parseFloat(paymentAmount)
    if (Number.isNaN(amount) || amount <= 0) return
    setPaymentRateError('')

    const payCur =
      paymentCurrency === 'XAU' && selectedDebt.isGold
        ? 'XAU'
        : clampFiatToAllowed(settings, paymentCurrency as Currency)

    if (paymentScheduleMode === 'recurring') {
      const pmId = paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
      addRecurringDebtPayment({
        debtId: selectedDebtId,
        amount,
        currency: payCur as Currency,
        frequency: recurringFrequency,
        nextDueDate: paymentDate,
        paymentMethodId: pmId,
        isActive: true,
        notes: paymentNotes || undefined,
      })
      showToast(tI18n.common.toastDebtPaymentRecorded)
      resetForm()
      closeSheet()
      return
    }

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
    const pmId = paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
    addDebtPaymentWithExpense(
      {
        debtId: selectedDebtId,
        date: paymentDate,
        amountPaid: amountInDebtUnit,
        paymentCurrency: payCur,
        originalAmount: amount,
        amountInPrimary: amountInBase,
        rateAtEntry,
        notes: paymentNotes || undefined,
      },
      {
        date: paymentDate,
        description: `${selectedDebt.name} — debt payment`,
        category: 'Debt',
        amount,
        currency: payCur as Currency,
        paymentMethodId: pmId,
        isRecurring: false,
        notes: paymentNotes || undefined,
        linkedDebtId: selectedDebtId,
        isDebtPayment: true,
      }
    )
    showToast(tI18n.common.toastDebtPaymentRecorded)
    resetForm()
    closeSheet()
  }, [
    addDebtPaymentWithExpense,
    addRecurringDebtPayment,
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
    paymentScheduleMode,
    recurringFrequency,
    resetForm,
    selectedDebt,
    selectedDebtId,
    settings,
    showToast,
    tI18n,
  ])

  const applyDebtReceivedVia = useCallback(
    (rv: DebtReceivedVia) => {
      setReceivedVia(rv)
      if (rv === 'gold') setCurrency('XAU')
      else setCurrency(settings.baseCurrency as DebtCurrency)
    },
    [settings.baseCurrency]
  )

  const selectDebtForPayFlow = useCallback((id: string) => {
    setSelectedDebtId(id)
    setPayDebtStep('form')
  }, [])

  const backToPayDebtList = useCallback(() => {
    setPayDebtStep('select')
    setPaymentAmount('')
    setPaymentRateError('')
  }, [])

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

  const installmentPreview = useMemo(() => {
    const total = parseFloat(startingBalance)
    const n = parseInt(installmentCount, 10)
    if (!startingBalance || Number.isNaN(total) || Number.isNaN(n) || n <= 0) return null
    const per = interestFree ? total / n : total / n
    return Math.round(per * 100) / 100
  }, [installmentCount, interestFree, startingBalance])

  return {
    isOpen,
    closeSheet,
    debtSheetPaymentOnly,
    isPayDebtFlow,
    payDebtStep,
    selectDebtForPayFlow,
    backToPayDebtList,
    mode,
    setMode,
    debtType,
    setDebtType,
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
    receivedVia,
    applyDebtReceivedVia,
    goldKarat,
    setGoldKarat,
    notes,
    setNotes,
    relationship,
    setRelationship,
    direction,
    setDirection,
    creditor,
    setCreditor,
    installmentItemName,
    setInstallmentItemName,
    installmentCount,
    setInstallmentCount,
    installmentFrequency,
    setInstallmentFrequency,
    installmentStartDate,
    setInstallmentStartDate,
    goalDraft,
    setGoalDraft,
    goalRemindRecurring,
    setGoalRemindRecurring,
    goalSheetOpen,
    setGoalSheetOpen,
    installmentPreview,
    canSubmitNewDebt,
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
    paymentScheduleMode,
    setPaymentScheduleMode,
    recurringFrequency,
    setRecurringFrequency,
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
