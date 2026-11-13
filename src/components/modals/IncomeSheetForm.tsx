'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { localTodayISO } from '@/lib/utils/localDate'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, Link2, Trash2 } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import type { Currency, IncomeRecurringFrequency, IncomeSource, IncomeSourceType } from '@/lib/store/types'
import type { PaydayPrefill } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { AssignIncomeSheet } from '@/components/modals/AssignIncomeSheet'
import { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { deriveDefaultPaydays, paydaysPerMonth } from '@/lib/utils/paydaySchedule'
import { MODAL_BODY_SCROLL_CLASS, MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const FREQS: IncomeRecurringFrequency[] = ['monthly', 'biweekly', 'weekly']

/**
 * The payday drift a new payday is written with (days a paycheck may land from its payday
 * and still be it). Always written explicitly on create — null would read the app default
 * of 5 for the late→missed threshold. There is no control for it in the sheet any more;
 * legacy rows keep null and exactly their current behaviour.
 */
const DEFAULT_DRIFT_PRESET = 7

/** Linked debt/savings sources may not have their type reassigned. */
function typeIsLocked(source?: IncomeSource): boolean {
  if (!source) return false
  if (source.linkedDebtId) return true
  return Boolean(source.linkedSavingsAccountId && (source.sourceType === 'savings' || source.sourceType === 'investment'))
}

interface Props {
  open: boolean
  onClose: () => void
  /**
   * `oneTime` — "Log money in" from + → Money in: a dated one-off, optionally linked to a
   * payday. `payday` — "New payday" from Paydays / "Make this recurring", and edit.
   */
  mode: 'oneTime' | 'payday'
  /** Present → edit that recurring source; absent → create. */
  source?: IncomeSource
  /** Seeds a new payday (a starter card, or the one-time row being made recurring). */
  prefill?: PaydayPrefill | null
}

/**
 * The one income sheet. `mode` fixes what it records — no switch inside: one-time money
 * from +, or a payday from Paydays. Editing seeds every field from the source and saves
 * through `updateIncomeSource`.
 */
export function IncomeSheetForm({ open, onClose, mode, source, prefill }: Props) {
  const edit = Boolean(source)
  const isRecurring = mode === 'payday'
  const showToast = useActionToast()
  const confirm = useConfirm()
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
  const [sourceType, setSourceType] = useState<IncomeSourceType>(source?.sourceType ?? 'salary')
  const [frequency, setFrequency] = useState<IncomeRecurringFrequency>(source?.recurringFrequency ?? 'monthly')
  const [paydays, setPaydays] = useState<number[]>(seedPaydays)
  const driftDays = source?.paydayDriftDays ?? null
  const [receivedDate, setReceivedDate] = useState(() => localTodayISO())
  const [assigned, setAssigned] = useState<{ templateId: string; date: string } | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState(source?.paymentMethodId ?? defaultPmId)
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(Boolean(source?.notes))

  const typeLocked = typeIsLocked(source)
  const submitOnce = useSubmitOnce(open)

  // Add mode reuses one instance, so reset defaults each time it opens. Edit mode
  // is keyed on the source id (remounts), so its useState seeds are enough.
  const prevIsOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset add defaults when the sheet opens */
    if (!edit && open && !prevIsOpen.current) {
      setCurrency((prefill?.currency as Currency | undefined) ?? settings.baseCurrency)
      setPaymentMethodId(prefill?.paymentMethodId ?? defaultPmId)
      setReceivedDate(localTodayISO())
      setPaydays([prefill?.dayOfMonth ?? new Date().getDate()])
      setAssigned(null)
      if (prefill?.name) setName(prefill.name)
      if (prefill?.amount) setAmount(String(prefill.amount))
      if (prefill?.sourceType) setSourceType(prefill.sourceType)
    }
    prevIsOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [edit, open, settings.baseCurrency, defaultPmId, prefill])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
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
    if (!name.trim() || !amtValid || !submitOnce.claim()) return
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
        paydayDriftDays: driftDays ?? DEFAULT_DRIFT_PRESET,
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
        paydayDriftDays: driftDays ?? DEFAULT_DRIFT_PRESET,
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
        // §8.0: linking picks the payday (occurrenceDate); receivedDate stays the real day.
        receivedDate,
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

  const handleDelete = async () => {
    if (!source || !(await confirm({ title: t.income.confirmDelete, destructive: true }))) return
    deleteIncomeSource(source.id)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* Header: title + subtitle, one-time date pill (add only), close */}
        <V3SheetHeader onClose={handleClose}>
          <V3SheetHeader.Title>{edit ? t.editIncome.title : isRecurring ? t.paydays.newTitle : t.addIncome.sheetTitle}</V3SheetHeader.Title>
          {!isRecurring ? <V3SheetHeader.Subtitle>{t.addIncome.addSubtitleOneTime}</V3SheetHeader.Subtitle> : null}
          {!isRecurring ? (
            <V3SheetHeader.Extra>
              <DatePickerField value={receivedDate} onChange={setReceivedDate} className="!h-8 !w-auto shrink-0 rounded-full !px-3 text-xs" />
            </V3SheetHeader.Extra>
          ) : null}
        </V3SheetHeader>

        <div className={`${MODAL_BODY_SCROLL_CLASS.replace('gap-5', 'gap-4')} px-4 pb-6`}>
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
                decimalsFor={currency}
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
              {t.addIncome.perMonthEquiv(`${Math.round(amt * paydaysPerMonth(frequency)).toLocaleString('en-US')} ${currency}`, paydaysPerMonth(frequency))}
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
                <div className="mt-1.5">
                  <SegmentedControl
                    ariaLabel={t.addIncome.howOftenLabel}
                    value={frequency}
                    onChange={(f) => {
                      setFrequency(f)
                      setPaydays(deriveDefaultPaydays(paydays[0] ?? new Date().getDate(), f))
                    }}
                    options={FREQS.map((f) => ({
                      value: f,
                      label:
                        f === 'monthly'
                          ? t.addIncome.freqMonthly
                          : f === 'biweekly'
                            ? t.addIncome.freqBiweekly
                            : t.addIncome.freqWeekly,
                    }))}
                  />
                </div>
              </div>
              {/* Payday grid */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={MODAL_LABEL_CLASS}>{t.addIncome.paydayLabel}</span>
                  {frequency !== 'monthly' ? (
                    <span className="text-[0.625rem] text-[var(--color-brand-text-muted)]">{t.addIncome.paydayHelper(frequency === 'biweekly' ? 2 : 4)}</span>
                  ) : null}
                </div>
                <div className="mt-1.5">
                  <IncomePaydayGrid frequency={frequency} days={paydays} onChange={setPaydays} />
                </div>
              </div>
            </>
          ) : (
            /* "Is this one of your paydays?" — link the one-off to a payday instead of counting it twice. */
            <Card variant="elevated" padding="none" className="rounded-2xl border border-[var(--color-brand-border)] p-3.5">
              {assignedSource ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.addIncome.assignedToSource(assignedSource.name)}</p>
                    {assigned ? <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{assigned.date}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="link" size="xs" onClick={() => setAssignOpen(true)} className="font-semibold text-[var(--color-brand-green)] no-underline hover:underline">{t.addIncome.assignChange}</Button>
                    <Button variant="link" size="xs" onClick={() => setAssigned(null)} className="font-semibold text-[var(--color-brand-text-muted)] no-underline hover:underline">{t.addIncome.assignRemove}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-brand-green)]">{t.addIncome.assignCardTitle}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{t.addIncome.assignCardBody}</p>
                  </div>
                  <Button variant="outline" size="touch" onClick={() => setAssignOpen(true)} className="shrink-0">
                    <Link2 className="size-4" strokeWidth={2} />
                    {t.addIncome.assignBtn}
                  </Button>
                </div>
              )}
            </Card>
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
            <Button variant="link" size="touch" onClick={() => setNotesOpen(true)} className="-mt-2 self-start">
              <ChevronDown className="size-4" strokeWidth={2} />
              {t.addIncome.labelNotes}
            </Button>
          )}
        </div>

        {/* Pinned footer: full-width Save CTA, with Delete as a distinct, less
            prominent action directly below it (edit only, non-shared sources). */}
        <div className="sheet-cta shrink-0 px-4 pb-5 pt-4">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !amtValid}
            size="cta-block"
            className="text-sm font-semibold"
          >
            {edit ? t.editIncome.buttonSave : isRecurring ? t.addIncome.buttonSubmit : t.common.save}
          </Button>
          {edit && source && !source.sharedPlanId ? (
            <Button
              type="button"
              onClick={() => void handleDelete()}
              variant="destructive"
              size="touch"
              className="mt-2 w-full text-sm"
            >
              <Trash2 className="h-4 w-4" />
              {t.common.delete}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Nested assign hero slider (add one-time only). */}
      {!isRecurring ? (
        <AssignIncomeSheet
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          credit={{ amount: amtValid ? amt : 0, currency, receivedDate }}
          onAssign={setAssigned}
          initialTemplateId={assigned?.templateId}
          zIndexClassName="z-[120]"
        />
      ) : null}
    </ModalShell>
  )
}
