'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { localTodayISO } from '@/lib/utils/localDate'
import { useShallow } from 'zustand/react/shallow'
import { X, Repeat, CalendarDays, ChevronDown, Link2, Trash2 } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type { Currency, IncomeRecurringFrequency, IncomeSource, IncomeSourceType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { AssignIncomeSheet } from '@/components/modals/AssignIncomeSheet'
import { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { deriveDefaultPaydays } from '@/lib/utils/paydaySchedule'
import { incomeMonthlyMultiplier } from '@/lib/utils/calculations'
import { MODAL_BODY_SCROLL_CLASS, MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'

const FREQS: IncomeRecurringFrequency[] = ['monthly', 'biweekly', 'weekly']

/** Linked debt/savings sources may not have their type reassigned. */
function typeIsLocked(source?: IncomeSource): boolean {
  if (!source) return false
  if (source.linkedDebtId) return true
  return Boolean(source.linkedSavingsAccountId && (source.sourceType === 'savings' || source.sourceType === 'investment'))
}

interface Props {
  open: boolean
  onClose: () => void
  /** Present → edit that recurring source (locked to recurring); absent → create. */
  source?: IncomeSource
}

/**
 * The one income sheet used by both Add and Edit. Editing seeds every field from
 * the source, locks the form to recurring (no one-time tab, no assign flow), and
 * saves through `updateIncomeSource`; adding keeps the recurring/one-time choice.
 */
export function IncomeSheetForm({ open, onClose, source }: Props) {
  const edit = Boolean(source)
  const showToast = useActionToast()
  const { addIncomeSource, updateIncomeSource, deleteIncomeSource, addIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      updateIncomeSource: s.updateIncomeSource,
      deleteIncomeSource: s.deleteIncomeSource,
      addIncomeEvent: s.addIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
    })),
  )
  const t = useT()
  const [assignOpen, setAssignOpen] = useState(false)
  const defaultPmId = paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  const seedPaydays = () =>
    source?.paydayDays?.length
      ? [...source.paydayDays].sort((a, b) => a - b)
      : source
        ? deriveDefaultPaydays(source.dayOfMonth ?? new Date().getDate(), source.recurringFrequency ?? 'monthly')
        : [new Date().getDate()]

  const [name, setName] = useState(source?.name ?? '')
  const [amount, setAmount] = useState(source ? String(source.amount) : '')
  const [currency, setCurrency] = useState<Currency>(source?.currency ?? settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(source ? true : true)
  const [sourceType, setSourceType] = useState<IncomeSourceType>(source?.sourceType ?? 'salary')
  const [frequency, setFrequency] = useState<IncomeRecurringFrequency>(source?.recurringFrequency ?? 'monthly')
  const [paydays, setPaydays] = useState<number[]>(seedPaydays)
  const [receivedDate, setReceivedDate] = useState(() => localTodayISO())
  const [assigned, setAssigned] = useState<{ templateId: string; date: string } | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState(source?.paymentMethodId ?? defaultPmId)
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(Boolean(source?.notes))

  const typeLocked = typeIsLocked(source)

  // Add mode reuses one instance, so reset defaults each time it opens. Edit mode
  // is keyed on the source id (remounts), so its useState seeds are enough.
  const prevIsOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset add defaults when the sheet opens */
    if (!edit && open && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
      setPaymentMethodId(defaultPmId)
      setReceivedDate(localTodayISO())
      setPaydays([new Date().getDate()])
      setAssigned(null)
    }
    prevIsOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [edit, open, settings.baseCurrency, defaultPmId])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setSourceType('salary')
    setFrequency('monthly')
    setPaydays([new Date().getDate()])
    setReceivedDate(localTodayISO())
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
    if (edit && source) {
      updateIncomeSource(source.id, {
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency: frequency,
        dayOfMonth: paydays[0] ?? 1,
        paydayDays: frequency !== 'monthly' && paydays.length ? paydays : undefined,
        notes: notes.trim() || undefined,
        paymentMethodId: paymentMethodId || undefined,
        ...(typeLocked ? {} : { sourceType }),
      })
      onClose()
      return
    }
    if (isRecurring) {
      addIncomeSource({
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency: frequency,
        dayOfMonth: paydays[0] ?? 1,
        ...(frequency !== 'monthly' && paydays.length ? { paydayDays: paydays } : {}),
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
        ...(assigned ? { occurrenceDate: assigned.date } : {}),
        status: 'confirmed',
        notes: notes.trim() || undefined,
        ...(assigned ? { templateId: assigned.templateId } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
      })
    }
    showToast(t.common.toastIncomeAdded)
    resetForm()
    onClose()
  }

  const handleClose = () => {
    if (!edit) resetForm()
    onClose()
  }
  useEscapeClose(open, handleClose)

  const handleDelete = () => {
    if (!source || !window.confirm(t.income.confirmDelete)) return
    deleteIncomeSource(source.id)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* Header: title + subtitle, one-time date pill (add only), close */}
        <div className="flex shrink-0 items-start gap-3 px-5 pt-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{edit ? t.editIncome.title : t.addIncome.sheetTitle}</h2>
            {!edit ? (
              <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">
                {isRecurring ? t.addIncome.addSubtitleRecurring : t.addIncome.addSubtitleOneTime}
              </p>
            ) : null}
          </div>
          {!edit && !isRecurring ? (
            <DatePickerField value={receivedDate} onChange={setReceivedDate} className="!h-8 !w-auto shrink-0 rounded-full !px-3 text-xs" />
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

        <div className={`${MODAL_BODY_SCROLL_CLASS} px-5 pb-6`}>
          {/* Amount + currency */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="min-w-0">
              <label htmlFor="income-amt" className={MODAL_LABEL_CLASS}>
                {isRecurring && frequency !== 'monthly' ? t.addIncome.amountPerPaycheckLabel : t.addIncome.labelAmount}
              </label>
              <AmountField
                id="income-amt"
                placeholder={t.addIncome.placeholderAmount}
                value={amount}
                onChange={setAmount}
                className={`mt-1.5 ${MODAL_CONTROL_CLASS} font-mono-numbers text-xl font-semibold`}
              />
            </div>
            <div className="w-[7.5rem] shrink-0">
              <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
              <FiatCurrencyField
                value={currency}
                onChange={setCurrency}
                compact
                className="mt-1.5 h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-focus)]"
              />
            </div>
          </div>
          {isRecurring && frequency !== 'monthly' && amtValid ? (
            <p className="-mt-2 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
              {t.addIncome.perMonthEquiv(`${Math.round(amt * incomeMonthlyMultiplier(frequency)).toLocaleString('en-US')} ${currency}`)}
            </p>
          ) : null}

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

          {/* Recurring / One-time tabs — add only (edit is locked to recurring) */}
          {!edit ? (
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
          ) : null}

          {/* Income type chip slider (locked for linked sources) */}
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.incomeTypeLabel}</span>
            <div className={`mt-1.5 ${typeLocked ? 'pointer-events-none opacity-60' : ''}`}>
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
                        onClick={() => {
                          setFrequency(f)
                          setPaydays(deriveDefaultPaydays(paydays[0] ?? new Date().getDate(), f))
                        }}
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
                <div className="flex items-baseline gap-2">
                  <span className={MODAL_LABEL_CLASS}>{t.addIncome.paydayLabel}</span>
                  {frequency !== 'monthly' ? (
                    <span className="text-[10px] text-[var(--color-brand-text-muted)]">{t.addIncome.paydayHelper(frequency === 'biweekly' ? 2 : 4)}</span>
                  ) : null}
                </div>
                <div className="mt-1.5">
                  <IncomePaydayGrid frequency={frequency} days={paydays} onChange={setPaydays} />
                </div>
              </div>
            </>
          ) : (
            /* Assign card (one-time, add only) */
            <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5">
              {assignedSource ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.addIncome.assignedToSource(assignedSource.name)}</p>
                    {assigned ? <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{assigned.date}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setAssignOpen(true)} className="text-xs font-semibold text-[var(--color-brand-green)]">{t.addIncome.assignChange}</button>
                    <button type="button" onClick={() => setAssigned(null)} className="text-xs font-semibold text-[var(--color-brand-text-muted)]">{t.addIncome.assignRemove}</button>
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
          <PaymentMethodPicker value={paymentMethodId} onChange={setPaymentMethodId} paymentMethods={paymentMethods} label={t.addIncome.labelPaymentMethod} />

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

        {/* Pinned footer: full-width Save CTA, with Delete as a distinct, less
            prominent action directly below it (edit only, non-shared sources). */}
        <div className="sheet-cta shrink-0 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !amtValid}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-red-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {edit ? t.editIncome.buttonSave : isRecurring ? t.addIncome.buttonSubmit : t.income.addIncomeCta}
          </button>
          {edit && source && !source.sharedPlanId ? (
            <button
              type="button"
              onClick={handleDelete}
              className="mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-sm text-[var(--color-brand-red)] opacity-80 hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
              {t.common.delete}
            </button>
          ) : null}
        </div>
      </div>

      {/* Nested assign hero slider (add one-time only). */}
      {!edit ? <AssignIncomeSheet open={assignOpen} onClose={() => setAssignOpen(false)} onAssign={setAssigned} initialTemplateId={assigned?.templateId} zIndexClassName="z-[120]" /> : null}
    </ModalShell>
  )
}
