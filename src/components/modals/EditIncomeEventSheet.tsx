'use client'

import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useT } from '@/lib/i18n'
import type { Currency, IncomeEvent, IncomeEventStatus, IncomeSourceType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
import { IncomeTemplatePicker } from '@/components/features/income/IncomeTemplatePicker'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
} from '@/lib/modals/modalFormClasses'

const DATE_INPUT_CLASS =
  'mt-1.5 w-full h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-red)] focus:outline-none'

function EditIncomeEventForm({ event, onClose }: { event: IncomeEvent; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const t = useT()
  const { updateIncomeEvent, deleteIncomeEvent, settings, paymentMethods, debts, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      updateIncomeEvent: s.updateIncomeEvent,
      deleteIncomeEvent: s.deleteIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      debts: s.debts,
      incomeSources: s.incomeSources,
    }))
  )
  const recurringTemplates = incomeSources.filter((s) => s.isRecurring)
  const linkedDebt = event.linkedDebtId ? debts.find((d) => d.id === event.linkedDebtId) : undefined
  const [debtChoiceOpen, setDebtChoiceOpen] = useState(false)
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
      amount: amt,
      currency: clampFiatToAllowed(settings, currency),
      receivedDate,
      notes: notes.trim() || undefined,
      paymentMethodId: paymentMethodId || undefined,
      ...(typeLocked ? {} : { sourceType, templateId: templateId || null, status }),
    })
    onClose()
  }

  const handleDelete = () => {
    // Borrowed money → let the user decide the debt's fate; otherwise a plain confirm.
    if (linkedDebt) {
      setDebtChoiceOpen(true)
      return
    }
    if (!window.confirm(t.income.confirmDelete)) return
    deleteIncomeEvent(event.id)
    onClose()
  }

  const finishDelete = (deleteLinkedDebt: boolean) => {
    deleteIncomeEvent(event.id, deleteLinkedDebt)
    setDebtChoiceOpen(false)
    onClose()
  }

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      <div className="shrink-0 px-5 pt-1">
        <ModalSheetHeader title={t.editIncome.title} onClose={onClose} />
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
              className={`mt-1.5 ${MODAL_CONTROL_CLASS} text-xl font-semibold font-mono-numbers`}
            />
          </div>
          <div className="w-[7.5rem] shrink-0">
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
            <FiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className="mt-1.5 w-full h-12 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm focus:border-[var(--color-brand-red)]"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.receivedDate}</Label>
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={DATE_INPUT_CLASS} />
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
                  <button
                    key={sVal}
                    type="button"
                    onClick={() => setStatus(sVal)}
                    className={`h-10 rounded-lg border text-xs font-semibold transition-colors ${
                      on
                        ? 'border-[var(--color-brand-red)] bg-[rgba(229,9,20,.1)] text-[var(--color-brand-text-primary)]'
                        : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'
                    }`}
                  >
                    {statusText[sVal]}
                  </button>
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

        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 py-3 text-sm text-[var(--color-brand-red)] opacity-80 hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
          {t.common.delete}
        </button>
      </div>

      <div className="shrink-0 px-5 pb-5 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!valid}
          className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.editIncome.buttonSave}
        </button>
      </div>
    </div>

    {debtChoiceOpen && linkedDebt ? (
      <ModalShell open onBackdropClick={() => setDebtChoiceOpen(false)} zIndexClassName="z-[110]" dragToClose={false}>
        <div className="w-full max-w-sm rounded-2xl bg-[var(--color-brand-card)] p-5">
          <h2 className="text-base font-bold text-[var(--color-brand-text-primary)]">{t.income.deleteWithDebtTitle}</h2>
          <p className="mt-2 text-sm text-[var(--color-brand-text-secondary)]">{t.income.deleteWithDebtBody(linkedDebt.name)}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => finishDelete(true)}
              className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold"
            >
              {t.income.deleteBoth}
            </button>
            <button
              type="button"
              onClick={() => finishDelete(false)}
              className="w-full py-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm font-semibold"
            >
              {t.income.keepDebt}
            </button>
            <button
              type="button"
              onClick={() => setDebtChoiceOpen(false)}
              className="w-full py-2.5 text-sm text-[var(--color-brand-text-muted)]"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </ModalShell>
    ) : null}
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
