'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Lock, Trash2, Unlink } from 'lucide-react'
import { ModalShell, useModalTitleId } from '@/components/modals/ModalShell'
import { ModalTitle } from '@/components/modals/ModalTitle'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useT } from '@/lib/i18n'
import type { Currency, IncomeEvent, IncomeEventStatus, IncomeSourceType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
import { IncomeTemplatePicker } from '@/components/features/income/IncomeTemplatePicker'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { OptionChip } from '@/components/ui/OptionChip'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { Badge } from '@/components/ui/badge'
import { FactsTable, type Fact } from '@/components/ui/FactsTable'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { eventDaysLate } from '@/lib/utils/incomeOccurrences'
import { cadenceLine } from '@/lib/income/cadence'
import { formatFixed2 } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { occurrenceChange } from '@/lib/income/occurrenceChange'
import { navigate } from '@/lib/navigation/navigate'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
} from '@/lib/modals/modalFormClasses'

const DATE_FIELD_CLASS = 'mt-1.5 h-12 rounded-xl'

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
    if (!deleteLinkedDebt) toast(t.moneyFlows.incomeDeleted, { undo: () => restoreIncomeEvent(event), undoLabel: t.common.undo })
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
          <ModalTitle>{t.income.deleteWithDebtTitle}</ModalTitle>
          <p className="mb-3 text-[13.5px] leading-[1.45] text-[var(--color-brand-text-secondary)]">{t.income.deleteWithDebtBody(linkedDebt.name)}</p>
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

/**
 * Income detail (screens 11, 12): what arrived, when, for which payday and where it went,
 * as facts. Recurring income keeps its payday and its arrival as two dates (§8.0), so a
 * late payday reads "3 days after the payday" for good. Editing is behind the pencil.
 */
function IncomeEventDetail({ event, onClose, onEdit }: { event: IncomeEvent; onClose: () => void; onEdit: () => void }) {
  const shortDate = useShortDate()
  const t = useT()
  const { incomeSources, paymentMethods, updateIncomeEvent } = useFinanceStore(
    useShallow((s) => ({ incomeSources: s.incomeSources, paymentMethods: s.paymentMethods, updateIncomeEvent: s.updateIncomeEvent })),
  )
  const { openNewPayday, setPaydayFocusId } = useSettingsStore(
    useShallow((s) => ({ openNewPayday: s.openNewPayday, setPaydayFocusId: s.setPaydayFocusId })),
  )
  const del = useDeleteIncomeEvent(event, onClose)
  const source = event.templateId ? incomeSources.find((s) => s.id === event.templateId) : undefined
  const recurring = Boolean(event.templateId)
  const daysLate = recurring ? eventDaysLate(event) : null
  const typeLabel = incomeSourceTypeLabel(t.income, event.sourceType)
  // §8.4/§8.5: only a payment method is a destination — never "Main account", never a savings/debt link.
  const pm = methodLabel(paymentMethods.find((m) => m.id === event.paymentMethodId))
  const paidInto: Fact = pm
    ? { label: t.income.factPaidInto, value: pm }
    : { label: t.income.factPaidInto, value: t.income.notRecorded, valueTone: 'var(--color-brand-text-muted)', sub: t.income.setAccount, subTone: 'var(--color-brand-primary-ink)' }
  const payday = event.occurrenceDate ?? event.receivedDate

  const facts: Fact[] = recurring
    ? [
        {
          label: t.income.factPayday,
          value: shortDate(payday),
          trailing: (
            <Button
              variant="link"
              size="touch"
              aria-label={t.income.unlinkAria(shortDate(payday))}
              onClick={() => updateIncomeEvent(event.id, { templateId: null, occurrenceDate: null })}
            >
              <Unlink className="size-3.5" strokeWidth={2} />
              {t.income.unlink}
            </Button>
          ),
        },
        {
          label: t.income.factArrived,
          value: shortDate(event.receivedDate),
          ...(daysLate ? { sub: t.income.daysAfterPayday(daysLate), subTone: 'var(--color-brand-amber)' } : {}),
        },
        paidInto,
        { label: t.income.factRecordedFrom, value: event.smsLogId ? t.income.recordedSms : t.income.recordedManual },
      ]
    : [
        { label: t.income.factReceived, value: shortDate(event.receivedDate) },
        paidInto,
        { label: t.income.factCountedIn, value: t.income.countedInOneTime },
      ]

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
          <IncomeTypeIcon type={event.sourceType} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <h2 id={useModalTitleId()} className="block text-[17px] font-bold text-[var(--color-brand-text-primary)]">
            {event.name}
          </h2>
          <span className="block text-[12.5px] text-[var(--color-brand-text-secondary)]">
            {recurring ? `${typeLabel}${source ? ` · ${cadenceLine(source, t)}` : ''}` : t.income.oneTimeIncome}
          </span>
        </span>
        {daysLate ? (
          <Badge variant="warning" size="xs">{t.income.daysLateChip(daysLate)}</Badge>
        ) : recurring ? (
          <Badge variant="brand" size="xs">{t.income.recurringLabel}</Badge>
        ) : (
          <Badge variant="muted" size="xs">{t.income.oneTimeLabel}</Badge>
        )}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono-numbers text-[32px] font-semibold tracking-[-0.02em] text-[var(--color-brand-green)]">
          +{formatFixed2(event.amount)}
        </span>
        <span className="text-[13px] text-[var(--color-brand-text-secondary)]">{event.currency}</span>
      </p>
      <FactsTable label={t.income.detailsLabel} onEdit={onEdit} editLabel={t.income.editIncomeAria} rows={facts} />
      {recurring ? null : (
        <p className="text-[12.5px] leading-[1.45] text-[var(--color-brand-text-secondary)]">{t.income.makeRecurringNote}</p>
      )}
      <div className={`grid gap-2 ${recurring ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[2fr_1fr]'}`}>
        {recurring ? (
          <Button
            variant="outline"
            size="cta"
            onClick={() => {
              if (source) setPaydayFocusId(source.id)
              onClose()
              navigate('/paydays')
            }}
          >
            {t.income.openInPaydays}
          </Button>
        ) : (
          <Button
            size="cta"
            onClick={() => {
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
        )}
        <Button variant="destructive" size="cta" onClick={() => void del.request()}>
          {t.common.delete}
        </Button>
      </div>
      {del.dialog}
    </div>
  )
}

function EditIncomeEventForm({ event, onClose }: { event: IncomeEvent; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const t = useT()
  const { updateIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      updateIncomeEvent: s.updateIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
    }))
  )
  const recurringTemplates = incomeSources.filter((s) => s.isRecurring)
  const del = useDeleteIncomeEvent(event, onClose)
  // Savings/investment/debt events are system-linked — keep their type read-only.
  const typeLocked = Boolean(event.linkedSavingsAccountId || event.linkedDebtId)

  const [name, setName] = useState(event.name)
  const [amount, setAmount] = useState(String(event.amount))
  const [currency, setCurrency] = useState<Currency>(event.currency)
  const [sourceType, setSourceType] = useState<IncomeSourceType>(event.sourceType ?? 'other')
  const [receivedDate, setReceivedDate] = useState(event.receivedDate)
  const [templateId, setTemplateId] = useState(event.templateId ?? '')
  const [status, setStatus] = useState<IncomeEventStatus>(event.status)
  const [paymentMethodId, setPaymentMethodId] = useState(event.paymentMethodId ?? '')
  const [notes, setNotes] = useState(event.notes ?? '')

  const amt = parseFloat(amount)
  const valid = name.trim().length > 0 && !Number.isNaN(amt) && amt > 0
  // Received-vs-expected status only makes sense for template-linked events.
  const STATUS_CHOICES: IncomeEventStatus[] = ['confirmed', 'late', 'partial', 'missed']
  const statusText: Record<IncomeEventStatus, string> = {
    confirmed: t.income.statusReceived,
    late: t.income.statusLate,
    partial: t.income.statusPartial,
    missed: t.income.statusMissed,
    projected: t.income.statusPending,
  }

  const handleSave = () => {
    if (!valid) return
    updateIncomeEvent(event.id, {
      name: name.trim(),
      receivedDate,
      notes: notes.trim() || undefined,
      paymentMethodId: paymentMethodId || undefined,
      ...(typeLocked
        ? {}
        : {
            amount: amt,
            currency: clampFiatToAllowed(settings, currency),
            sourceType,
            templateId: templateId || null,
            status,
            ...occurrenceChange(event, templateId, receivedDate),
          }),
    })
    onClose()
  }

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      <div className="shrink-0 px-5 pt-1">
        <V3SheetHeader title={t.editIncome.title} onClose={onClose} />
      </div>
      <div className={`${MODAL_BODY_SCROLL_CLASS} px-5`}>
        {!typeLocked ? (
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelSourceType}</span>
            <div className="mt-1.5">
              <IncomeSourceTypePicker value={sourceType} onChange={setSourceType} labels={t.income} mode="manual" />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="ie-name" className={MODAL_LABEL_CLASS}>{t.addIncome.labelSource}</label>
          <Input id="ie-name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${MODAL_CONTROL_CLASS}`} />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="min-w-0">
            <label htmlFor="ie-amt" className={MODAL_LABEL_CLASS}>{t.addIncome.labelAmount}</label>
            <AmountField
              id="ie-amt"
              value={amount}
              onChange={setAmount}
              disabled={typeLocked}
              className={`mt-1.5 ${MODAL_CONTROL_CLASS} text-xl font-semibold font-mono-numbers`}
            />
          </div>
          <div className="w-[7.5rem] shrink-0">
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
            <FiatCurrencyField
              value={currency}
              onChange={setCurrency}
              compact
              disabled={typeLocked}
              className="mt-1.5 w-full h-12 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm focus:border-[var(--color-brand-focus)]"
            />
          </div>
        </div>

        {typeLocked ? (
          <p className="flex items-center gap-1.5 text-[12.5px] leading-[1.45] text-[var(--color-brand-text-secondary)]">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            {t.moneyFlows.incomeLocked}
          </p>
        ) : null}

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.receivedDate}</Label>
          <DatePickerField value={receivedDate} onChange={setReceivedDate} className={DATE_FIELD_CLASS} />
        </div>

        {!typeLocked ? (
          <IncomeTemplatePicker
            value={templateId}
            onChange={setTemplateId}
            templates={recurringTemplates}
            label={t.income.linkToRecurring}
            noneLabel={t.income.notLinkedToRecurring}
          />
        ) : null}

        {!typeLocked && templateId ? (
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.income.statusLabel}</span>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {STATUS_CHOICES.map((sVal) => {
                const on = status === sVal
                return (
                  <OptionChip
                    key={sVal}
                    size="segment"
                    selected={on}
                    onClick={() => setStatus(sVal)}
                    className="h-10 text-xs"
                  >
                    {statusText[sVal]}
                  </OptionChip>
                )
              })}
            </div>
          </div>
        ) : null}

        <PaymentMethodPicker
          value={paymentMethodId}
          onChange={setPaymentMethodId}
          paymentMethods={paymentMethods}
          label={t.addIncome.labelPaymentMethod}
        />

        <div>
          <label htmlFor="ie-notes" className={MODAL_LABEL_CLASS}>{t.addIncome.labelNotes}</label>
          <Textarea
            id="ie-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 min-h-16 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>

        <Button
          type="button"
          onClick={() => void del.request()}
          variant="destructive"
          size="touch"
          className="w-full text-sm"
        >
          <Trash2 className="h-4 w-4" />
          {t.common.delete}
        </Button>
      </div>

      <div className="sheet-cta shrink-0 px-5 pb-5 pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!valid}
          size="cta-block"
          className="text-sm font-semibold"
        >
          {t.editIncome.buttonSave}
        </Button>
      </div>
    </div>

    {del.dialog}
    </>
  )
}

export function EditIncomeEventSheet() {
  const incomeEvents = useFinanceStore((s) => s.incomeEvents)
  const { activeModal, setActiveModal, editingIncomeEventId, setEditingIncomeEventId } = useSettingsStore()
  const isOpen = activeModal === 'editIncomeEvent'
  const event = incomeEvents.find((e) => e.id === editingIncomeEventId)
  const [editing, setEditing] = useState(false)

  const close = () => {
    setActiveModal(null)
    setEditingIncomeEventId(null)
    setEditing(false)
  }

  return (
    <ModalShell open={isOpen && !!event} onBackdropClick={close} scrollChild={editing}>
      {event ? (
        editing ? (
          <EditIncomeEventForm key={event.id} event={event} onClose={close} />
        ) : (
          <IncomeEventDetail key={event.id} event={event} onClose={close} onEdit={() => setEditing(true)} />
        )
      ) : null}
    </ModalShell>
  )
}
