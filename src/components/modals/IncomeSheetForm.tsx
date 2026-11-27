'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { localTodayISO } from '@/lib/utils/localDate'
import { useShallow } from 'zustand/react/shallow'
import { Calendar, ChevronDown, Link2, Trash2 } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT, useLocale } from '@/lib/i18n'
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
import { OptionChip } from '@/components/ui/OptionChip'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { AssignIncomeSheet } from '@/components/modals/AssignIncomeSheet'
import { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
import { deriveDefaultPaydays } from '@/lib/utils/paydaySchedule'
import { MODAL_BODY_SCROLL_CLASS, MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { defaultMethodId } from '@/lib/accounts/resolve'
import { PaydayFormBody, type FormFrequency } from '@/components/features/income/PaydayFormBody'
import { paydayCandidates } from '@/lib/income/paydayResolution'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { manualOccurredAt, mergeDayTime, nowClock } from '@/lib/time/occurredAt'
import { formatClock } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { paydayMethodId } from '@/lib/income/paydayMethod'

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
  const { addIncomeSource, updateIncomeSource, updateIncomeEvent, deleteIncomeSource, addIncomeEvent, settings, paymentMethods, incomeSources, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      updateIncomeEvent: s.updateIncomeEvent,
      updateIncomeSource: s.updateIncomeSource,
      deleteIncomeSource: s.deleteIncomeSource,
      addIncomeEvent: s.addIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
      exchangeRates: s.exchangeRates,
    })),
  )
  const t = useT()
  const lt = useDebtsSubsLtCopy().payday
  const [assignOpen, setAssignOpen] = useState(false)
  const defaultPmId = defaultMethodId(paymentMethods)
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
  const [irregular, setIrregular] = useState(Boolean(source?.irregular))
  const [icon, setIcon] = useState<string | undefined>(source?.icon)
  const weekendFirst = useWeekendFirstDay()
  const [paydays, setPaydays] = useState<number[]>(seedPaydays)
  const driftDays = source?.paydayDriftDays ?? null
  const [receivedDate, setReceivedDate] = useState(() => localTodayISO())
  /** A time picked in the date card (`HH:mm`); '' = the current time, as the pill shows. */
  const [clock, setClock] = useState('')
  const [calOpen, setCalOpen] = useState(false)
  const { locale } = useLocale()
  const [assigned, setAssigned] = useState<{ templateId: string; date: string } | null>(null)
  // Edit shows the stored account, the same one the Paydays list names; only a new payday starts on the default.
  const [paymentMethodId, setPaymentMethodId] = useState(source ? paydayMethodId(source, paymentMethods) : defaultPmId)
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
      setClock('')
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
    setIrregular(false)
    setIcon(undefined)
    setPaydays([new Date().getDate()])
    setReceivedDate(localTodayISO())
    setClock('')
    setAssigned(null)
    setPaymentMethodId(defaultPmId)
    setNotes('')
    setNotesOpen(false)
  }, [settings.baseCurrency, defaultPmId])

  const flowLt = useFlowLtCopy()
  // A new entry shows the current time until one is picked.
  const shownClock = clock || (edit ? '' : nowClock())
  const clockAt = mergeDayTime(receivedDate, shownClock)
  const amt = parseFloat(amount)
  const amtValid = !Number.isNaN(amt) && amt > 0
  const assignedSource = assigned ? incomeSources.find((s) => s.id === assigned.templateId) : undefined

  const handleSubmit = () => {
    if (!name.trim() || !amtValid || !submitOnce.claim()) return
    const cur = clampFiatToAllowed(settings, currency)
    // Irregular keeps a monthly schedule underneath (`IncomeSource.irregular`), so every frequency reader stays as it is.
    const schedule: IncomeRecurringFrequency = irregular ? 'monthly' : frequency
    const ownIcon = sourceType === 'other' ? icon : undefined
    if (edit && source) {
      updateIncomeSource(source.id, {
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency: schedule,
        irregular,
        ...(typeLocked ? {} : { icon: ownIcon }),
        dayOfMonth: paydays[0] ?? 1,
        paydayDays: schedule !== 'monthly' && paydays.length ? paydays : undefined,
        paydayDriftDays: driftDays ?? DEFAULT_DRIFT_PRESET,
        notes: notes.trim() || undefined,
        paymentMethodId: paymentMethodId || undefined,
        ...(typeLocked ? {} : { sourceType }),
      })
      onClose()
      return
    }
    if (isRecurring) {
      // "Add salary" from the Assign sheet: the money that started it belongs to the new salary from its own month on.
      const credit = prefill?.assignEventId ? useFinanceStore.getState().incomeEvents.find((e) => e.id === prefill.assignEventId) : undefined
      const today = localTodayISO()
      const id = addIncomeSource({
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency: schedule,
        ...(irregular ? { irregular: true } : {}),
        ...(ownIcon ? { icon: ownIcon } : {}),
        dayOfMonth: paydays[0] ?? 1,
        ...(schedule !== 'monthly' && paydays.length ? { paydayDays: paydays } : {}),
        paydayDriftDays: driftDays ?? DEFAULT_DRIFT_PRESET,
        sourceType,
        notes: notes.trim() || undefined,
        ...(paymentMethodId ? { paymentMethodId } : {}),
        ...(credit && credit.receivedDate < today ? { effectiveStart: credit.receivedDate } : {}),
      })
      if (credit && !credit.templateId) {
        const st = useFinanceStore.getState()
        const created = st.incomeSources.filter((x) => x.id === id)
        const best = paydayCandidates(credit, created, st.incomeEvents, settings.monthStartDay, exchangeRates, new Date(), weekendFirst)[0]
        // Same write as the Assign sheet: the payday goes on occurrenceDate, receivedDate stays the day it arrived.
        updateIncomeEvent(credit.id, { templateId: id, occurrenceDate: best?.occ.dueDate ?? credit.receivedDate, status: 'confirmed' })
      }
    } else {
      addIncomeEvent({
        name: name.trim(),
        amount: amt,
        currency: cur,
        sourceType,
        // §8.0: linking picks the payday (occurrenceDate); receivedDate stays the real day.
        receivedDate,
        occurredAt: manualOccurredAt(receivedDate, clock),
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
    // Like an expense delete: the toast can bring it back.
    showToast(t.moneyFlows.incomeDeleted, { undo: () => useFinanceStore.getState().restoreIncomeSource(source), undoLabel: t.common.undo })
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        {/* Header: title + subtitle, one-time date pill (add only), close */}
        <V3SheetHeader
          onClose={handleClose}
          actions={isRecurring && edit && source && !source.sharedPlanId ? (
            <V3SheetHeader.Action tone="danger" icon={<Trash2 />} label={t.common.delete} onClick={() => void handleDelete()} />
          ) : undefined}
        >
          <V3SheetHeader.Title size={isRecurring ? 'compact' : undefined}>{isRecurring ? (edit ? lt.editTitle : lt.newTitle) : edit ? t.editIncome.title : t.addIncome.sheetTitle}</V3SheetHeader.Title>
          {!isRecurring ? <V3SheetHeader.Subtitle>{t.addIncome.addSubtitleOneTime}</V3SheetHeader.Subtitle> : null}
          {!isRecurring ? (
            <V3SheetHeader.Extra>
              <OptionChip as="trigger" size="sm" onClick={() => setCalOpen(true)} aria-haspopup="dialog" aria-expanded={calOpen}>
                <Calendar className="size-3.5 text-[var(--color-brand-text-muted)]" />
                {formatDatePillLabel(receivedDate, locale, t.expenseForm.today)}
                {clockAt ? <span className="font-mono-numbers text-[var(--color-brand-text-muted)]">· {formatClock(new Date(clockAt), locale)}</span> : null}
              </OptionChip>
            </V3SheetHeader.Extra>
          ) : null}
        </V3SheetHeader>

        <div className={`${MODAL_BODY_SCROLL_CLASS.replace('gap-5', 'gap-4')} px-5 pb-6`}>
          {isRecurring ? (
            <PaydayFormBody
              amount={amount}
              onAmount={setAmount}
              currency={currency}
              onCurrency={setCurrency}
              base={settings.baseCurrency}
              rates={exchangeRates}
              frequency={irregular ? 'irregular' : frequency}
              onFrequency={(f: FormFrequency) => {
                const next = f === 'irregular' ? 'monthly' : f
                setIrregular(f === 'irregular')
                setFrequency(next)
                setPaydays(deriveDefaultPaydays(paydays[0] ?? new Date().getDate(), next))
              }}
              icon={icon}
              onIcon={setIcon}
              paydays={paydays}
              onPaydays={setPaydays}
              name={name}
              onName={setName}
              sourceType={sourceType}
              onSourceType={setSourceType}
              typeLocked={typeLocked}
              paymentMethodId={paymentMethodId}
              onPaymentMethod={setPaymentMethodId}
              paymentMethods={paymentMethods}
            />
          ) : (<>
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

          {
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
          }

          {/* Received into (reused payment carousel) */}
          <PaymentMethodPicker value={paymentMethodId} onChange={setPaymentMethodId} paymentMethods={paymentMethods} label={t.addIncome.labelPaymentMethod} />
          </>)}

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
        <div className="sheet-cta shrink-0 px-5 pb-5 pt-4">
          {!amtValid ? (
            <p className="mb-2 text-center text-xs font-medium text-[var(--color-brand-text-muted)]" role="status">
              {t.expenseForm.cueAmount}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !amtValid}
            size="cta-block"
            className="text-sm font-semibold"
          >
            {isRecurring ? (edit ? lt.save : lt.add) : edit ? t.editIncome.buttonSave : t.common.save}
          </Button>
          {!isRecurring && edit && source && !source.sharedPlanId ? (
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

      {calOpen ? (
        <UnifiedDatePicker
          open
          value={receivedDate}
          onConfirm={setReceivedDate}
          max={localTodayISO()}
          time={{ value: shownClock, label: flowLt.expense.time }}
          onConfirmDateTime={(iso, hm) => {
            setReceivedDate(iso)
            setClock(hm)
          }}
          onClose={() => setCalOpen(false)}
        />
      ) : null}
    </ModalShell>
  )
}
