'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Calendar, Lock, MessageSquare, StickyNote, Trash2, Unlink } from 'lucide-react'
import { ModalShell, useDismissGuard } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock, intlTag } from '@/lib/i18n/dateFormat'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { clockOf, editedOccurredAt, mergeDayTime } from '@/lib/time/occurredAt'
import type { Currency, IncomeEvent, IncomeEventStatus, IncomeSourceType } from '@/lib/store/types'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { PillButton } from '@/components/ui/PillButton'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { MethodValue } from '@/components/features/expenses/MethodValue'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { amountInputText } from '@/lib/ui/amountSanitize'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { incomeTypeGridItem } from '@/lib/constants/categoryGrid'
import { eventDaysLate } from '@/lib/utils/incomeOccurrences'
import { countPassThroughCredit } from '@/lib/spending/passThrough'
import { useShortDate } from '@/hooks/useShortDate'
import { occurrenceChange } from '@/lib/income/occurrenceChange'
import { navigate } from '@/lib/navigation/navigate'
import { cardBankName } from '@/lib/payment/cardThemes'

/**
 * Delete, with the borrowed-money branch: an income linked to a debt asks whether the debt
 * goes too. Shared by the detail view and the edit form.
 */
function useDeleteIncomeEvent(event: IncomeEvent, onDone: () => void) {
  const t = useT()
  const toast = useActionToast()
  const { deleteIncomeEvent, restoreIncomeEvent, debts } = useFinanceStore(
    useShallow((s) => ({ deleteIncomeEvent: s.deleteIncomeEvent, restoreIncomeEvent: s.restoreIncomeEvent, debts: s.debts })),
  )
  const deleteWithUndo = (deleteLinkedDebt?: boolean) => {
    deleteIncomeEvent(event.id, deleteLinkedDebt)
    if (!deleteLinkedDebt) toast(t.moneyFlows.incomeDeleted, {
      undo: () => {
        if (!restoreIncomeEvent(event)) toast(t.moneyFlows.undoPocketSpent)
      },
      undoLabel: t.common.undo,
    })
  }
  const linkedDebt = event.linkedDebtId ? debts.find((d) => d.id === event.linkedDebtId) : undefined
  const [debtChoiceOpen, setDebtChoiceOpen] = useState(false)
  const confirm = useConfirm()
  const request = async () => {
    if (linkedDebt) {
      setDebtChoiceOpen(true)
      return
    }
    if (!(await confirm({ title: t.income.confirmDeleteEntry, destructive: true }))) return
    deleteWithUndo()
    onDone()
  }
  const finish = (deleteLinkedDebt: boolean) => {
    deleteWithUndo(deleteLinkedDebt)
    setDebtChoiceOpen(false)
    onDone()
  }
  const dialog =
    debtChoiceOpen && linkedDebt ? (
      <ModalShell open onBackdropClick={() => setDebtChoiceOpen(false)} zIndexClassName="z-[110]">
        <div className="flex flex-col gap-2 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
          <V3SheetHeader.DialogTitle align="start">{t.income.deleteWithDebtTitle}</V3SheetHeader.DialogTitle>
          <p className="mb-3 text-[0.84375rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">{t.income.deleteWithDebtBody(linkedDebt.name)}</p>
          <Button variant="destructive-solid" size="cta-block" onClick={() => finish(true)}>
            {t.income.deleteBoth}
          </Button>
          <Button variant="outline" size="cta-block" onClick={() => finish(false)}>
            {t.income.keepDebt}
          </Button>
          <Button variant="ghost" size="cta-block" onClick={() => setDebtChoiceOpen(false)}>
            {t.common.cancel}
          </Button>
        </div>
      </ModalShell>
    ) : null
  return { request, dialog }
}

/** The payday statuses a linked income can be set to (the old status chips). */
const STATUS_CHOICES: IncomeEventStatus[] = ['confirmed', 'late', 'partial', 'missed']

/**
 * Money that came in, Light touch: the same sheet as an expense. The date pill top-left with the bin and close, the
 * amount with its currency inline and the name under it with which payday it filled, then Type, Received in, Payday
 * and where it was recorded from, and a slim note. A recurring payday keeps its payday and its arrival as two dates
 * (§8.0); linking goes through the assign sheet and the linked payday opens in Paydays.
 */
function EditIncomeEventForm({ event, onClose }: { event: IncomeEvent; onClose: () => void }) {
  const t = useT()
  const lt = useFlowLtCopy()
  const { locale } = useLocale()
  const shortDate = useShortDate()
  const { updateIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      updateIncomeEvent: s.updateIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
    }))
  )
  const { openNewPayday, setPaydayFocusId, openAssignIncome } = useSettingsStore(
    useShallow((s) => ({ openNewPayday: s.openNewPayday, setPaydayFocusId: s.setPaydayFocusId, openAssignIncome: s.openAssignIncome })),
  )
  const del = useDeleteIncomeEvent(event, onClose)
  // Savings/investment/debt events are system-linked — keep their type and amount read-only.
  const typeLocked = Boolean(event.linkedSavingsAccountId || event.linkedDebtId)

  const [name, setName] = useState(event.name)
  const [amount, setAmount] = useState(amountInputText(event.amount, event.currency))
  const [currency, setCurrency] = useState<Currency>(event.currency)
  const [sourceType, setSourceType] = useState<IncomeSourceType>(event.sourceType ?? 'other')
  const [receivedDate, setReceivedDate] = useState(event.receivedDate)
  const savedClock = clockOf(event.occurredAt, event.receivedDate)
  const [clock, setClock] = useState(savedClock)
  const [paymentMethodId, setPaymentMethodId] = useState(event.paymentMethodId ?? '')
  const [notes, setNotes] = useState(event.notes ?? '')
  const [status, setStatus] = useState<IncomeEventStatus>(event.status)
  const [statusOpen, setStatusOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const n = noteRef.current
    if (!n) return
    n.style.height = 'auto'
    n.style.height = `${n.scrollHeight}px`
  }, [notes])

  const source = event.templateId ? incomeSources.find((s) => s.id === event.templateId) : undefined
  const recurring = Boolean(event.templateId)
  const daysLate = recurring ? eventDaysLate(event) : null
  const payday = event.occurrenceDate ?? event.receivedDate
  const clockAt = mergeDayTime(receivedDate, clock)
  const time = clockAt ? formatClock(new Date(clockAt), locale) : null
  const method = paymentMethods.find((m) => m.id === paymentMethodId)
  const savedMethod = paymentMethods.find((m) => m.id === event.paymentMethodId)
  const parent = savedMethod?.parentId ? paymentMethods.find((m) => m.id === savedMethod.parentId) : undefined
  const monthOf = (iso: string) => new Intl.DateTimeFormat(intlTag(locale), { month: 'long' }).format(new Date(`${iso.slice(0, 10)}T00:00:00`))
  const line =
    event.exclusion === 'pass_through'
      ? lt.income.linePassThrough
      : recurring
        ? daysLate ? lt.income.lineLate(monthOf(payday), daysLate) : lt.income.lineOnTime(monthOf(payday))
        : lt.income.lineOneTime
  const statusText: Record<IncomeEventStatus, string> = {
    confirmed: t.income.statusReceived,
    late: t.income.statusLate,
    partial: t.income.statusPartial,
    missed: t.income.statusMissed,
    projected: t.income.statusPending,
  }

  const amt = parseFloat(amount)
  const valid = name.trim().length > 0 && !Number.isNaN(amt) && amt > 0
  const isDirty =
    name !== event.name ||
    amount !== amountInputText(event.amount, event.currency) ||
    currency !== event.currency ||
    sourceType !== (event.sourceType ?? 'other') ||
    receivedDate !== event.receivedDate ||
    clock !== savedClock ||
    paymentMethodId !== (event.paymentMethodId ?? '') ||
    notes !== (event.notes ?? '') ||
    status !== event.status
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Leaving with edits (close, Escape, backdrop, swipe-down, Android back: ModalShell asks the guard) asks to save or discard.
  const handleX = () => {
    if (isDirty) setConfirmOpen(true)
    else onClose()
  }
  useDismissGuard(() => {
    if (confirmOpen) {
      setConfirmOpen(false)
      return true
    }
    if (isDirty) {
      setConfirmOpen(true)
      return true
    }
    return false
  })

  /** Writes the edits; false when they are not valid yet. */
  const persist = (): boolean => {
    if (!valid) return false
    // A picked time moves the instant, a cleared one drops it; untouched, the store keeps its own rule for a re-dated row.
    const occurredAt = editedOccurredAt(receivedDate, clock, { day: event.receivedDate, clock: savedClock })
    updateIncomeEvent(event.id, {
      name: name.trim(),
      receivedDate,
      ...(occurredAt ? { occurredAt } : {}),
      notes: notes.trim() || undefined,
      paymentMethodId: paymentMethodId || undefined,
      ...(typeLocked
        ? {}
        : {
            amount: amt,
            currency: clampFiatToAllowed(settings, currency),
            sourceType,
            // Received / late / partial / missed only means something against a payday.
            ...(recurring ? { status } : {}),
            ...occurrenceChange(event, event.templateId ?? '', receivedDate),
          }),
    })
    return true
  }
  const handleSave = () => {
    if (persist()) onClose()
  }

  // Rows that leave the sheet keep what was typed: a valid edit is saved first.
  const openPayday = () => {
    if (isDirty) persist()
    if (recurring) {
      if (source) setPaydayFocusId(source.id)
      onClose()
      navigate('/paydays')
    } else {
      openAssignIncome({ eventId: event.id })
    }
  }

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      <V3SheetHeader
        onClose={handleX}
        leading={
          <PillButton icon={<Calendar />} onClick={() => setCalOpen(true)} aria-haspopup="dialog" aria-expanded={calOpen} className="h-9 border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] font-semibold">
            <span dir="auto">{`${formatDatePillLabel(receivedDate, locale, t.expenseForm.today)}${time ? ` · ${time}` : ''}`}</span>
          </PillButton>
        }
        actions={<V3SheetHeader.Action icon={<Trash2 size={16} />} label={lt.income.deleteAria} tone="danger" onClick={() => void del.request()} />}
      >
        <span className="sr-only">
          <V3SheetHeader.Title>{t.editIncome.title}</V3SheetHeader.Title>
        </span>
      </V3SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AmountHero
          id="ie-amt"
          value={amount}
          onChange={setAmount}
          readOnly={typeLocked}
          currency={currency}
          onCurrencyChange={(c) => setCurrency(c as Currency)}
          base={settings.baseCurrency}
          sign="+"
          top={
            <span aria-hidden className="flex size-[52px] items-center justify-center rounded-[16px]" style={{ background: 'var(--color-brand-green-soft)', color: 'var(--color-brand-green)' }}>
              <IncomeTypeIcon type={sourceType} className="size-6" />
            </span>
          }
          line={typeLocked ? (
            <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5 shrink-0" aria-hidden />{t.moneyFlows.incomeLocked}</span>
          ) : ''}
          className="pb-0"
        />
        <div className="flex flex-col items-center px-5 pb-5 text-center">
          <input
            id="ie-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onCompositionUpdate={(e) => setName(e.currentTarget.value)}
            onCompositionEnd={(e) => setName(e.currentTarget.value)}
            aria-label={t.addIncome.labelSource}
            placeholder={t.addIncome.namePlaceholder}
            dir="auto"
            maxLength={120}
            className="w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
          />
          <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{line}</p>
        </div>

        <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
          <PickerRow
            label={lt.income.type}
            onClick={typeLocked ? undefined : () => setTypeOpen(true)}
            value={<span className="truncate">{incomeSourceTypeLabel(t.income, sourceType)}</span>}
          />
          <PickerRow
            label={lt.income.receivedIn}
            onClick={() => setMethodOpen(true)}
            value={method ? <MethodValue method={method} /> : <span className="font-semibold text-[var(--color-brand-primary-ink)]">{t.income.setAccount}</span>}
          />
          <PickerRow
            label={lt.income.payday}
            onClick={typeLocked ? undefined : openPayday}
            value={
              recurring ? (
                <span className="truncate">{[incomeSourceTypeLabel(t.income, event.sourceType ?? source?.sourceType), shortDate(payday)].join(' · ')}</span>
              ) : (
                <span className="text-[var(--color-brand-text-muted)]">{lt.income.notLinked}</span>
              )
            }
          />
          <PickerRow
            label={lt.expense.recordedFrom}
            value={
              event.smsLogId ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MessageSquare className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
                  <span className="truncate">{savedMethod ? lt.expense.fromSms(cardBankName(savedMethod, parent)) : lt.expense.fromSmsPlain}</span>
                </span>
              ) : (
                lt.expense.fromYou
              )
            }
          />
        </Card>

        <label className="mx-4 mt-3 flex min-h-12 items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3">
          <StickyNote className="mt-[3px] size-[18px] shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
          <textarea
            id="ie-notes"
            ref={noteRef}
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label={t.addIncome.labelNotes}
            placeholder={t.expenseForm.notePlaceholder}
            dir="auto"
            className="block min-h-6 w-full resize-none overflow-hidden bg-transparent text-[0.9375rem] leading-6 text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
          />
        </label>
        {/* Not in the mockup: the payday status, Unlink and the one-time actions stay reachable as quiet links under the note. */}
        {recurring || event.exclusion === 'pass_through' || !typeLocked ? (
          <div className="mx-4 mt-1 flex flex-wrap justify-center gap-x-2">
            {recurring && !typeLocked ? (
              <Button variant="link" size="touch" className="text-[var(--color-brand-text-secondary)]" aria-haspopup="dialog" onClick={() => setStatusOpen(true)}>
                {t.income.statusLabel}: {statusText[status]}
              </Button>
            ) : null}
            {recurring ? (
              <Button
                variant="link"
                size="touch"
                aria-label={t.income.unlinkAria(shortDate(payday))}
                onClick={() => updateIncomeEvent(event.id, { templateId: null, occurrenceDate: null })}
              >
                <Unlink className="size-3.5" strokeWidth={2} />
                {t.income.unlink}
              </Button>
            ) : null}
            {event.exclusion === 'pass_through' ? (
              <Button variant="link" size="touch" onClick={() => countPassThroughCredit(event.id)}>
                {t.income.countAsIncome}
              </Button>
            ) : null}
            {!recurring && !typeLocked ? (
              <Button
                variant="link"
                size="touch"
                onClick={() => {
                  if (isDirty) persist()
                  onClose()
                  openNewPayday({
                    name: event.name,
                    amount: event.amount,
                    currency: event.currency,
                    sourceType: event.sourceType,
                    dayOfMonth: Number(event.receivedDate.slice(8, 10)) || 1,
                    paymentMethodId: event.paymentMethodId,
                  })
                }}
              >
                {t.income.makeRecurring}
              </Button>
            ) : null}
          </div>
        ) : null}

      </div>

      <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-6 pt-3">
        <Button type="button" onClick={handleSave} disabled={!valid} size="cta-block" className="font-semibold">
          {t.editIncome.buttonSave}
        </Button>
      </div>
    </div>

    <OptionSheet
      open={statusOpen}
      onClose={() => setStatusOpen(false)}
      title={t.income.statusLabel}
      value={status}
      onChange={(v) => setStatus(v)}
      options={STATUS_CHOICES.map((v) => ({ value: v, title: statusText[v] }))}
    />
    <OptionSheet
      open={typeOpen}
      onClose={() => setTypeOpen(false)}
      title={lt.income.typePickTitle}
      value={sourceType}
      onChange={(v) => setSourceType(v)}
      options={MANUAL_INCOME_SOURCE_TYPES.map((st) => {
        const { icon: Icon, accent } = incomeTypeGridItem(st)
        return { value: st, title: incomeSourceTypeLabel(t.income, st), icon: <Icon />, tone: accent }
      })}
    />
    <SelectPaymentMethodSheet
      open={methodOpen}
      value={paymentMethodId}
      paymentMethods={paymentMethods}
      onSelect={setPaymentMethodId}
      onClose={() => setMethodOpen(false)}
    />
    {calOpen ? (
      <UnifiedDatePicker
        open
        value={receivedDate}
        onConfirm={setReceivedDate}
        time={{ value: clock, label: lt.expense.time }}
        onConfirmDateTime={(iso, hm) => {
          setReceivedDate(iso)
          setClock(hm)
        }}
        onClose={() => setCalOpen(false)}
      />
    ) : null}
    <UnsavedChangesDialog
      open={confirmOpen}
      title={valid ? undefined : lt.expense.incompleteTitle}
      body={valid ? lt.income.unsavedBody : lt.expense.incompleteBody}
      onSave={
        valid
          ? () => {
              setConfirmOpen(false)
              handleSave()
            }
          : undefined
      }
      onDiscard={() => {
        setConfirmOpen(false)
        onClose()
      }}
      onKeep={() => setConfirmOpen(false)}
    />
    {del.dialog}
    </>
  )
}

export function EditIncomeEventSheet() {
  const incomeEvents = useFinanceStore((s) => s.incomeEvents)
  const { activeModal, setActiveModal, editingIncomeEventId, setEditingIncomeEventId } = useSettingsStore()
  const isOpen = activeModal === 'editIncomeEvent'
  const event = incomeEvents.find((e) => e.id === editingIncomeEventId)

  const close = () => {
    setActiveModal(null)
    setEditingIncomeEventId(null)
  }

  return (
    <ModalShell open={isOpen && !!event} onBackdropClick={close} scrollChild>
      {event ? <EditIncomeEventForm key={event.id} event={event} onClose={close} /> : null}
    </ModalShell>
  )
}
