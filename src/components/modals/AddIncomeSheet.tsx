'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType } from '@/lib/store/types'
import { AddIncomeFormFields } from '@/components/modals/AddIncomeFormFields'

export function AddIncomeSheet() {
  const showToast = useActionToast()
  const { addIncomeSource, addIncomeWithDebt, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addIncome'

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [sourceType, setSourceType] = useState<IncomeSourceType>('salary')
  const [isRecurring, setIsRecurring] = useState(true)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [notes, setNotes] = useState('')
  const [debtPerson, setDebtPerson] = useState('')
  const [debtDescription, setDebtDescription] = useState('')
  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setSourceType('salary')
    setIsRecurring(true)
    setRecurringFrequency('monthly')
    setDayOfMonth('1')
    setNotes('')
    setDebtPerson('')
    setDebtDescription('')
  }, [settings.baseCurrency])

  const onSourceTypeChange = useCallback((st: IncomeSourceType) => {
    setSourceType(st)
    if (st === 'salary') {
      setIsRecurring(true)
      setRecurringFrequency('monthly')
    }
    if (st === 'debt') {
      setIsRecurring(false)
    }
  }, [])

  const handleSubmit = () => {
    if (!name || !amount || parseFloat(amount) <= 0) return
    const cur = clampFiatToAllowed(settings, currency)
    if (sourceType === 'debt') {
      if (!debtPerson.trim()) return
      addIncomeWithDebt(
        {
          name,
          amount: parseFloat(amount),
          currency: cur,
          isRecurring: false,
          recurringFrequency: undefined,
          dayOfMonth: undefined,
          notes: notes || undefined,
        },
        { personName: debtPerson.trim(), description: debtDescription.trim() || undefined }
      )
    } else {
      addIncomeSource({
        name,
        amount: parseFloat(amount),
        currency: cur,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
        notes: notes || undefined,
        sourceType,
      })
    }

    showToast(t.common.toastIncomeAdded)
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  const debtOk = sourceType !== 'debt' || debtPerson.trim().length > 0

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
      <div className="p-6">
        <ModalSheetHeader title={t.addIncome.sheetTitle} onClose={handleClose} />

        <AddIncomeFormFields
          t={t}
          name={name}
          setName={setName}
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          sourceType={sourceType}
          onSourceTypeChange={onSourceTypeChange}
          isRecurring={isRecurring}
          setIsRecurring={setIsRecurring}
          recurringFrequency={recurringFrequency}
          setRecurringFrequency={setRecurringFrequency}
          dayOfMonth={dayOfMonth}
          setDayOfMonth={setDayOfMonth}
          notes={notes}
          setNotes={setNotes}
          debtPerson={debtPerson}
          setDebtPerson={setDebtPerson}
          debtDescription={debtDescription}
          setDebtDescription={setDebtDescription}
        />

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name || !amount || !debtOk}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.addIncome.buttonSubmit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
