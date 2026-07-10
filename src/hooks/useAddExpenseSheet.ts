'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeCreditCardOutstanding } from '@/lib/debt/computeCreditCardBalance'
import { formatCurrency } from '@/lib/utils/formatters'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Currency } from '@/lib/store/types'
import { matchPaymentMethodForExpense } from '@/lib/modals/matchPaymentMethodForExpense'
import { usePlanCategories } from '@/hooks/usePlanCategories'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'

export function useAddExpenseSheet() {
  const showToast = useActionToast()
  const t = useT()
  const { addExpense, paymentMethods, settings, debtPayments, debts, expenses, exchangeRates } =
    useFinanceStore(
      useShallow((s) => ({
        addExpense: s.addExpense,
        paymentMethods: s.paymentMethods,
        settings: s.settings,
        debtPayments: s.debtPayments,
        debts: s.debts,
        expenses: s.expenses,
        exchangeRates: s.exchangeRates,
      }))
    )
  const { activeModal, setActiveModal, expensePrefill, setExpensePrefill } = useSettingsStore()
  const isOpen = activeModal === 'addExpense'
  const { categoryChipOptions, defaultCategory } = usePlanCategories()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [category, setCategory] = useState<string>(defaultCategory)
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined)
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [notes, setNotes] = useState('')
  const [submitError, setSubmitError] = useState('')
  const skipNextDefaultCurrencySync = useRef(false)

  const creditCardOutstandingHint = useMemo(() => {
    const pm = paymentMethods.find((m) => m.id === paymentMethodId)
    if (!pm || pm.type !== 'credit_card') return null
    const cardDebt = debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === pm.id)
    if (!cardDebt) return null
    const pays = debtPayments.filter((p) => p.debtId === cardDebt.id)
    const out = computeCreditCardOutstanding(cardDebt, expenses, pays, exchangeRates)
    return { cardName: cardDebt.name, amountLabel: formatCurrency(out, cardDebt.currency) }
  }, [paymentMethodId, paymentMethods, debts, debtPayments, expenses, exchangeRates])

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
      if (expensePrefill.category) {
        setCategory(expensePrefill.category)
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
    setCategory(defaultCategory)
    setSubcategory(undefined)
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setNotes('')
    setSubmitError('')
  }, [paymentMethods, settings.baseCurrency, defaultCategory])

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
      subcategory,
      amount: parsedAmount,
      currency: cur,
      paymentMethodId,
      isRecurring: false,
      notes: notes || undefined,
    })
    showToast(t.common.toastExpenseLogged)
    resetForm()
    setActiveModal(null)
  }, [
    addExpense,
    amount,
    category,
    subcategory,
    date,
    description,
    notes,
    paymentMethodId,
    resetForm,
    setActiveModal,
    settings,
    currency,
    showToast,
    t,
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
    subcategory,
    setSubcategory,
    paymentMethodId,
    setPaymentMethodId,
    notes,
    setNotes,
    submitError,
    setSubmitError,
    paymentMethods,
    categoryChipOptions,
    handleSubmit,
    creditCardOutstandingHint,
  }
}
