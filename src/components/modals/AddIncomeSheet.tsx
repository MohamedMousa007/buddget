'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type { Currency } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { useDraftEntry } from '@/lib/onboarding/draftEntry'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
  MODAL_SHEET_OUTER_CLASS,
} from '@/lib/modals/modalFormClasses'

interface IncomeDraftShape {
  name: string
  amount: string
  currency: Currency
  isRecurring: boolean
}

export function AddIncomeSheet() {
  const showToast = useActionToast()
  const { addIncomeSource, settings, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
    }))
  )
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addIncome'

  const draft = useDraftEntry<IncomeDraftShape>('incomeSources')

  const [name, setName] = useState(draft.initial?.name ?? '')
  const [amount, setAmount] = useState(draft.initial?.amount ?? '')
  const [currency, setCurrency] = useState<Currency>(
    draft.initial?.currency ?? settings.baseCurrency,
  )
  const [isRecurring, setIsRecurring] = useState(draft.initial?.isRecurring ?? true)

  const prevIsOpen = useRef(false)
  const defaultPmId =
    paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      if (!draft.active || !draft.initial?.currency) {
        setCurrency(settings.baseCurrency)
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, draft.active, draft.initial])

  useEffect(() => {
    if (!isOpen || !draft.active) return
    draft.update({ name, amount, currency, isRecurring })
  }, [isOpen, draft, name, amount, currency, isRecurring])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
  }, [settings.baseCurrency])

  const handleSubmit = () => {
    if (!name.trim() || !amount.trim()) return
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt <= 0) return
    const cur = clampFiatToAllowed(settings, currency)
    const pm = defaultPmId || undefined

    addIncomeSource({
      name: name.trim(),
      amount: amt,
      currency: cur,
      isRecurring,
      recurringFrequency: isRecurring ? 'monthly' : undefined,
      sourceType: isRecurring ? 'salary' : 'other',
      ...(pm ? { paymentMethodId: pm } : {}),
    })

    showToast(t.common.toastIncomeAdded)
    draft.clear()
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    if (!draft.active) resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
      <div className={`${MODAL_SHEET_OUTER_CLASS} p-5`}>
        <div className="shrink-0">
          <ModalSheetHeader title={t.addIncome.sheetTitle} onClose={handleClose} />
        </div>
        <div className={MODAL_BODY_SCROLL_CLASS}>
          <div>
            <label htmlFor="income-name" className={MODAL_LABEL_CLASS}>
              {t.addIncome.labelSource}
            </label>
            <Input
              id="income-name"
              placeholder={t.addIncome.placeholderSource}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="min-w-0">
              <label htmlFor="income-amt" className={MODAL_LABEL_CLASS}>
                {t.addIncome.labelAmount}
              </label>
              <Input
                id="income-amt"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={t.addIncome.placeholderAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`mt-1.5 ${MODAL_CONTROL_CLASS} text-xl font-semibold font-mono-numbers`}
              />
            </div>
            <div className="w-[7.5rem] shrink-0">
              <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
              <FiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className={`mt-1.5 w-full h-12 px-3 rounded-xl border border-[#2A2A38] bg-[#1A1A24] text-white text-sm focus:border-[#E50914]`}
              />
            </div>
          </div>
          <div
            className="flex items-center justify-between gap-3 py-1"
          >
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelRecurring}</span>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
        </div>
        <div className="shrink-0 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !name.trim() ||
              !amount.trim() ||
              Number.isNaN(parseFloat(amount)) ||
              parseFloat(amount) <= 0
            }
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.addIncome.buttonSubmit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
