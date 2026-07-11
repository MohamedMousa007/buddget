'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Repeat, CalendarDays, ChevronDown, Link2 } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { AssignIncomeSheet } from '@/components/modals/AssignIncomeSheet'
import { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { MODAL_BODY_SCROLL_CLASS, MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'

const FREQS: IncomeRecurringFrequency[] = ['monthly', 'biweekly', 'weekly']

export function AddIncomeSheet() {
  const showToast = useActionToast()
  const { addIncomeSource, addIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      addIncomeEvent: s.addIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
    })),
  )
  const { activeModal, setActiveModal } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal })),
  )
  const [assignOpen, setAssignOpen] = useState(false)
  const t = useT()
  const isOpen = activeModal === 'addIncome'
  const defaultPmId = paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(true)
  const [sourceType, setSourceType] = useState<IncomeSourceType>('salary')
  const [frequency, setFrequency] = useState<IncomeRecurringFrequency>('monthly')
  const [payday, setPayday] = useState(() => new Date().getDate())
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assigned, setAssigned] = useState<{ templateId: string; date: string } | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState(defaultPmId)
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)

  const prevIsOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset defaults when the sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
      setPaymentMethodId(defaultPmId)
      setReceivedDate(new Date().toISOString().slice(0, 10))
      setPayday(new Date().getDate())
      setAssigned(null)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, defaultPmId])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setSourceType('salary')
    setFrequency('monthly')
    setPayday(new Date().getDate())
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setAssigned(null)
    setPaymentMethodId(defaultPmId)
    setNotes('')
    setNotesOpen(false)
  }, [settings.baseCurrency, defaultPmId])

  const amt = parseFloat(amount)
  const amtValid = !Number.isNaN(amt) && amt > 0
  const assignedSource = assigned ? incomeSources.find((s) => s.id === assigned.templateId) : undefined

  const handleSubmit = () => {
    if (!name.trim() || !amtValid) return
    const cur = clampFiatToAllowed(settings, currency)
    if (isRecurring) {
      addIncomeSource({
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency: frequency,
        dayOfMonth: payday,
        sourceType,
        notes: notes.trim() || undefined,
        ...(paymentMethodId ? { paymentMethodId } : {}),
      })
    } else {
      addIncomeEvent({
        name: name.trim(),
        amount: amt,
        currency: cur,
        sourceType,
        receivedDate: assigned ? assigned.date : receivedDate,
        status: 'confirmed',
        notes: notes.trim() || undefined,
        ...(assigned ? { templateId: assigned.templateId } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
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

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* Header: title + subtitle, one-time date pill, close */}
        <div className="flex shrink-0 items-start gap-3 px-5 pt-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.addIncome.sheetTitle}</h2>
            <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">
              {isRecurring ? t.addIncome.addSubtitleRecurring : t.addIncome.addSubtitleOneTime}
            </p>
          </div>
          {!isRecurring ? (
            <DatePickerField
              value={receivedDate}
              onChange={setReceivedDate}
              className="!h-8 !w-auto shrink-0 rounded-full !px-3 text-xs"
            />
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            aria-label={t.common.cancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`${MODAL_BODY_SCROLL_CLASS} px-5`}>
          {/* Amount + currency */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="min-w-0">
              <label htmlFor="income-amt" className={MODAL_LABEL_CLASS}>{t.addIncome.labelAmount}</label>
              <AmountField
                id="income-amt"
                placeholder={t.addIncome.placeholderAmount}
                value={amount}
                onChange={setAmount}
                className={`mt-1.5 ${MODAL_CONTROL_CLASS} font-mono-numbers text-xl font-semibold text-[var(--color-brand-green)]`}
              />
            </div>
            <div className="w-[7.5rem] shrink-0">
              <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
              <FiatCurrencyField
                value={currency}
                onChange={setCurrency}
                className="mt-1.5 h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-red)]"
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="income-name" className={MODAL_LABEL_CLASS}>{t.addIncome.labelSource}</label>
            <Input
              id="income-name"
              placeholder={t.addIncome.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
            />
          </div>

          {/* Recurring / One-time tabs (independent of type) */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--color-brand-elevated)] p-1">
            {([true, false] as const).map((rec) => {
              const on = isRecurring === rec
              const Icon = rec ? Repeat : CalendarDays
              return (
                <button
                  key={String(rec)}
                  type="button"
                  onClick={() => setIsRecurring(rec)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    on ? 'bg-[var(--color-brand-card)] text-[var(--color-brand-text-primary)] shadow-sm' : 'text-[var(--color-brand-text-muted)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {rec ? t.addIncome.tabRecurring : t.addIncome.tabOneTime}
                </button>
              )
            })}
          </div>

          {/* Income type chip slider */}
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.incomeTypeLabel}</span>
            <div className="mt-1.5">
              <IncomeTypeChipSlider value={sourceType} onChange={setSourceType} labels={t.income} />
            </div>
          </div>

          {isRecurring ? (
            <>
              {/* How often */}
              <div>
                <span className={MODAL_LABEL_CLASS}>{t.addIncome.howOftenLabel}</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {FREQS.map((f) => {
                    const on = frequency === f
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                          on ? 'bg-[var(--color-brand-red)] text-white' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
                        }`}
                      >
                        {f === 'monthly' ? t.addIncome.freqMonthly : f === 'biweekly' ? t.addIncome.freqBiweekly : t.addIncome.freqWeekly}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Payday grid */}
              <div>
                <span className={MODAL_LABEL_CLASS}>{t.addIncome.paydayLabel}</span>
                <div className="mt-1.5">
                  <IncomePaydayGrid frequency={frequency} value={payday} onChange={setPayday} />
                </div>
              </div>
            </>
          ) : (
            /* Assign card (one-time) */
            <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5">
              {assignedSource ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">
                      {t.addIncome.assignedToSource(assignedSource.name)}
                    </p>
                    {assigned ? <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{assigned.date}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setAssignOpen(true)} className="text-xs font-semibold text-[var(--color-brand-green)]">
                      {t.addIncome.assignChange}
                    </button>
                    <button type="button" onClick={() => setAssigned(null)} className="text-xs font-semibold text-[var(--color-brand-text-muted)]">
                      {t.addIncome.assignRemove}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-brand-green)]">{t.addIncome.assignCardTitle}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{t.addIncome.assignCardBody}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[rgba(29,185,84,0.16)] px-3.5 py-2 text-sm font-bold text-[var(--color-brand-green)]"
                  >
                    <Link2 className="h-4 w-4" />
                    {t.addIncome.assignBtn}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Received into (reused payment carousel) */}
          <PaymentMethodPicker
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            paymentMethods={paymentMethods}
            label={t.addIncome.labelPaymentMethod}
          />

          {/* Notes */}
          {notesOpen ? (
            <div>
              <label htmlFor="income-notes" className={MODAL_LABEL_CLASS}>{t.addIncome.labelNotes}</label>
              <Textarea
                id="income-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.addIncome.placeholderNotes}
                className="mt-1.5 min-h-16 border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]"
              />
            </div>
          ) : (
            <button type="button" onClick={() => setNotesOpen(true)} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-[var(--color-brand-green)]">
              <ChevronDown className="h-4 w-4" />
              {t.addIncome.labelNotes}
            </button>
          )}
        </div>

        <div className="shrink-0 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !amtValid}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-red-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRecurring ? t.addIncome.buttonSubmit : t.income.addIncomeCta}
          </button>
        </div>
      </div>

      {/* Nested assign hero slider (local state keeps this sheet mounted underneath). */}
      <AssignIncomeSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssign={setAssigned}
        zIndexClassName="z-[120]"
      />
    </ModalShell>
  )
}
