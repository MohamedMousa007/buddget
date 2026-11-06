'use client'

import { reconcileExclusion } from '@/lib/spending/exclusion'
import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { usePlanCategories } from '@/hooks/usePlanCategories'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { canonicalAmount, currencyDecimals, parseLocalizedAmount } from '@/lib/ui/amountParse'
import type { Expense, Currency, SpendExclusion } from '@/lib/store/types'

export function useEditExpenseForm(expense: Expense, onClose: () => void) {
  const { updateExpense, paymentMethods, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ updateExpense: s.updateExpense, paymentMethods: s.paymentMethods, settings: s.settings, exchangeRates: s.exchangeRates })),
  )
  const t = useT()
  const { categoryChipOptions } = usePlanCategories()
  const submit = useSubmitOnce()

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

  // A 3-decimal amount (KWD 1.234) must not outlive a switch to a 2-decimal currency.
  const changeCurrency = useCallback((next: Currency) => {
    setCurrency(next)
    setAmount((a) => canonicalAmount(a, currencyDecimals(next)))
  }, [])

  const handleSubmit = useCallback(() => {
    const cur = currency === expense.currency ? currency : clampFiatToAllowed(settings, currency)
    const parsedAmount = parseLocalizedAmount(amount, cur)
    const title = description.trim()
    if (!title || !(parsedAmount > 0)) return

    const amountInBase = tryConvertCurrency(parsedAmount, cur, settings.baseCurrency, exchangeRates)
    if (amountInBase === null) {
      setSubmitError(
        `${t.common.tryAgain} — ${cur} → ${settings.baseCurrency}`
      )
      return
    }
    if (!submit.claim()) return
    setSubmitError('')

    const exclusion = paymentMethodId === expense.paymentMethodId ? spendExclusion : reconcileExclusion(spendExclusion, paymentMethods, paymentMethodId)
    updateExpense(expense.id, {
      date,
      description: title,
      category,
      subcategory,
      amount: parsedAmount,
      currency: cur,
      amountInBaseCurrency: amountInBase,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
      spendExclusion: exclusion,
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
    expense.currency,
    expense.owedSettledAt,
    expense.paymentMethodId,
    spendExclusion,
    owedBy,
    paymentMethods,
    isRecurring,
    notes,
    onClose,
    paymentMethodId,
    settings,
    t.common.tryAgain,
    updateExpense,
    submit,
  ])

  return {
    date,
    setDate,
    description,
    setDescription,
    amount,
    setAmount,
    currency,
    setCurrency: changeCurrency,
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
