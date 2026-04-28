'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import {
  convertPaymentToDebtUnit,
  computeDebtPaymentRecord,
  isDebtFullyPaid,
  type DebtBalanceContext,
} from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { clampDebtFiatToAllowed, clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type {
  Currency,
  Debt,
  DebtCurrency,
  DebtKind,
  DebtReceivedVia,
  DebtRecurringFrequency,
  GoldKarat,
  InstallmentProvider,
} from '@/lib/store/types'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'

type NewDebtPayload = Omit<Debt, 'id' | 'createdAt'>

function isDebtListedAsActive(d: { status?: 'active' | 'cleared' }): boolean {
  return d.status !== 'cleared'
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
    addCreditCardDebt,
    addDebtPayment,
    addDebtPaymentWithExpense,
    addRecurringDebtPayment,
    debts,
    debtPayments,
    expenses,
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
  const [startingBalance, setStartingBalance] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>(
    () => useFinanceStore.getState().settings.baseCurrency as DebtCurrency
  )
  const [receivedVia, setReceivedVia] = useState<DebtReceivedVia>('cash')
  const isGold = receivedVia === 'gold'
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
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
  const [ccLast4, setCcLast4] = useState('')
  const [ccCreditLimit, setCcCreditLimit] = useState('')
  const [ccPaymentDueDay, setCcPaymentDueDay] = useState('15')
  const [ccGraceDays, setCcGraceDays] = useState('55')
  const [ccMinPercent, setCcMinPercent] = useState('5')
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider>('other')
  const [linkedCreditCardDebtId, setLinkedCreditCardDebtId] = useState('')

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

  const debtBalanceCtx: DebtBalanceContext | undefined = useMemo(
    () => ({ expenses, exchangeRates, allDebts: debts }),
    [expenses, exchangeRates, debts]
  )

  const payableDebts = useMemo(
    () =>
      debts.filter(
        (d) => isDebtListedAsActive(d) && !isDebtFullyPaid(d, debtPayments, debtBalanceCtx)
      ),
    [debts, debtPayments, debtBalanceCtx]
  )

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)
  const selectedPayable = payableDebts.find((d) => d.id === selectedDebtId)

  const closeSheet = useCallback(() => {
    resetDebtSheetIntent()
    setActiveModal(null)
    setPayDebtStep('select')
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
    if (debtType === 'credit_card' && receivedVia === 'gold') {
      setReceivedVia('cash')
      setCurrency(settings.baseCurrency as DebtCurrency)
    }
  }, [debtType, receivedVia, isOpen, settings.baseCurrency])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- BNPL defaults when switching provider */
    if (installmentProvider === 'tabby' || installmentProvider === 'tamara') {
      setInstallmentCount('4')
      setInstallmentFrequency('monthly')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [installmentProvider])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default linked card when list loads */
    if (debtType !== 'installment' || installmentProvider !== 'credit_card') return
    const list = debts.filter((d) => d.debtType === 'credit_card')
    if (list.length === 0) return
    if (!linkedCreditCardDebtId || !list.some((d) => d.id === linkedCreditCardDebtId)) {
      setLinkedCreditCardDebtId(list[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [debtType, installmentProvider, debts, linkedCreditCardDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- keep payment target on a payable debt while sheet open */
    if (!isOpen) return
    if (mode !== 'payment' && !debtSheetPaymentOnly && !isPayDebtFlow) return
    if (payableDebts.length === 0) return
    const sel = debts.find((d) => d.id === selectedDebtId)
    if (!sel || isDebtFullyPaid(sel, debtPayments, debtBalanceCtx)) {
      setSelectedDebtId(payableDebts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    isOpen,
    mode,
    debtSheetPaymentOnly,
    isPayDebtFlow,
    debts,
    debtPayments,
    payableDebts,
    selectedDebtId,
    debtBalanceCtx,
  ])

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
    setStartingBalance('')
    setCurrency(settings.baseCurrency as DebtCurrency)
    setReceivedVia('cash')
    setRelationship('')
    setDirection('i_owe')
    setCreditor('')
    setInstallmentItemName('')
    setInstallmentCount('12')
    setInstallmentFrequency('monthly')
    setInstallmentStartDate(new Date().toISOString().slice(0, 10))
    setInterestFree(true)
    setPaymentAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setPaymentRateError('')
    setPaymentScheduleMode('one_time')
    setRecurringFrequency('monthly')
    setCcLast4('')
    setCcCreditLimit('')
    setCcPaymentDueDay('15')
    setCcGraceDays('55')
    setCcMinPercent('5')
    setInstallmentProvider('other')
    setLinkedCreditCardDebtId('')
  }, [settings.baseCurrency])

  const canSubmitNewDebt = useMemo(() => {
    if (debtType === 'credit_card') {
      const out = parseFloat(startingBalance)
      if (startingBalance === '' || Number.isNaN(out) || out < 0) return false
      return !!name.trim()
    }
    const total = parseFloat(startingBalance)
    if (!startingBalance || Number.isNaN(total) || total <= 0) return false
    if (debtType === 'personal') return !!(name.trim() && person.trim())
    if (debtType === 'installment') {
      const n = parseInt(installmentCount, 10)
      const baseOk = !!(installmentItemName.trim() && !Number.isNaN(n) && n > 0 && installmentStartDate)
      if (!baseOk) return false
      if (installmentProvider === 'credit_card' && !linkedCreditCardDebtId) return false
      return true
    }
    return !!(name.trim() && person.trim())
  }, [
    debtType,
    installmentCount,
    installmentItemName,
    installmentStartDate,
    installmentProvider,
    linkedCreditCardDebtId,
    name,
    person,
    startingBalance,
  ])

  const handleAddDebt = useCallback(() => {
    if (!canSubmitNewDebt) return
    const total = parseFloat(startingBalance)
    if (debtType === 'credit_card') {
      const out = Number.isNaN(total) ? 0 : Math.max(0, total)
      addCreditCardDebt(
        {
          name: name.trim(),
          person: '',
          description: undefined,
          startingBalance: out,
          currency: clampDebtFiatToAllowed(settings, currency),
          isGold: false,
          notes: undefined,
          emoji: '💳',
          creditLimit: ccCreditLimit.trim() ? parseFloat(ccCreditLimit) : undefined,
          paymentDueDay: ccPaymentDueDay.trim() ? parseInt(ccPaymentDueDay, 10) : undefined,
          gracePeriodDays: parseInt(ccGraceDays, 10) || 55,
          minimumPaymentPercent: parseFloat(ccMinPercent) || 5,
        },
        { name: name.trim(), last4: ccLast4.trim() || undefined }
      )
      showToast(tI18n.common.toastDebtAdded)
      resetForm()
      closeSheet()
      return
    }
    const baseEmoji = isGold ? '🪙' : '💳'
    const payload: NewDebtPayload = {
      name: debtType === 'installment' ? installmentItemName.trim() : name.trim(),
      person:
        debtType === 'installment'
          ? 'Installment'
          : debtType === 'general'
            ? person.trim() || creditor.trim() || 'General'
            : person.trim(),
      description: undefined,
      startingBalance: total,
      currency: isGold ? 'XAU' : clampDebtFiatToAllowed(settings, currency),
      isGold,
      goldKarat: isGold ? goldKarat : undefined,
      notes: undefined,
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
      payload.installmentProvider = installmentProvider
      if (installmentProvider === 'credit_card' && linkedCreditCardDebtId) {
        payload.linkedCreditCardDebtId = linkedCreditCardDebtId
      }
    }
    if (debtType === 'general') {
      payload.creditor = creditor.trim() || undefined
    }

    addDebt(payload)

    showToast(tI18n.common.toastDebtAdded)
    resetForm()
    closeSheet()
  }, [
    addCreditCardDebt,
    addDebt,
    canSubmitNewDebt,
    ccCreditLimit,
    ccGraceDays,
    ccLast4,
    ccMinPercent,
    ccPaymentDueDay,
    closeSheet,
    creditor,
    currency,
    debtType,
    direction,
    installmentCount,
    installmentFrequency,
    installmentItemName,
    installmentProvider,
    installmentStartDate,
    interestFree,
    isGold,
    linkedCreditCardDebtId,
    receivedVia,
    name,
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
      debtPayments,
      debtBalanceCtx
    )
    if (!computed.ok) {
      setPaymentRateError(computed.error)
      return
    }
    const { amountInDebtUnit, amountInBase, rateAtEntry } = computed
    const pmId = paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
    if (selectedDebt.debtType === 'credit_card') {
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
      showToast(tI18n.common.toastDebtPaymentRecorded)
      resetForm()
      closeSheet()
      return
    }
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
    addDebtPayment,
    addDebtPaymentWithExpense,
    addRecurringDebtPayment,
    closeSheet,
    debtBalanceCtx,
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

  const creditCardDebts = useMemo(() => debts.filter((d) => d.debtType === 'credit_card'), [debts])

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
    startingBalance,
    setStartingBalance,
    currency,
    setCurrency,
    receivedVia,
    applyDebtReceivedVia,
    goldKarat,
    setGoldKarat,
    relationship,
    setRelationship,
    direction,
    setDirection,
    creditor,
    setCreditor,
    ccLast4,
    setCcLast4,
    ccCreditLimit,
    setCcCreditLimit,
    ccPaymentDueDay,
    setCcPaymentDueDay,
    ccGraceDays,
    setCcGraceDays,
    ccMinPercent,
    setCcMinPercent,
    creditCardDebts,
    installmentProvider,
    setInstallmentProvider,
    linkedCreditCardDebtId,
    setLinkedCreditCardDebtId,
    installmentItemName,
    setInstallmentItemName,
    installmentCount,
    setInstallmentCount,
    installmentFrequency,
    setInstallmentFrequency,
    installmentStartDate,
    setInstallmentStartDate,
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
