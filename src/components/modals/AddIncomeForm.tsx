'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Calendar, StickyNote } from 'lucide-react'
import { useDismissGuard } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { localTodayISO } from '@/lib/utils/localDate'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock } from '@/lib/i18n/dateFormat'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { manualOccurredAt, mergeDayTime, nowClock } from '@/lib/time/occurredAt'
import type { Currency, IncomeSourceType } from '@/lib/store/types'
import { AmountHero } from '@/components/ui/AmountHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { HEADER_PILL, PillButton } from '@/components/ui/PillButton'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { UnifiedDatePicker, formatDatePillLabel } from '@/components/ui/UnifiedDatePicker'
import { SelectPaymentMethodSheet } from '@/components/features/payments/SelectPaymentMethodSheet'
import { MethodValue } from '@/components/features/expenses/MethodValue'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import { AssignIncomeSheet } from '@/components/modals/AssignIncomeSheet'
import { useActionToast } from '@/components/ui/ActionToast'
import { useSubmitOnce } from '@/hooks/useSubmitOnce'
import { useShortDate } from '@/hooks/useShortDate'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { MANUAL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { incomeTypeGridItem } from '@/lib/constants/categoryGrid'
import { defaultMethodId } from '@/lib/accounts/resolve'

const HIDE_SCROLL = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * "Log money in" (+ → Money in), Light touch: the same sheet as an expense. The date pill top-left with close, the
 * amount with its currency inline and the name under it, then Type, Received in and Payday (linking it to a payday
 * instead of counting it twice), a slim note, and Save. Mounted per open, so every open starts blank.
 */
export function AddIncomeForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lt = useFlowLtCopy()
  const { locale } = useLocale()
  const shortDate = useShortDate()
  const toast = useActionToast()
  const submitOnce = useSubmitOnce(true)
  const { addIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({ addIncomeEvent: s.addIncomeEvent, settings: s.settings, paymentMethods: s.paymentMethods, incomeSources: s.incomeSources })),
  )

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [sourceType, setSourceType] = useState<IncomeSourceType>('other')
  const [receivedDate, setReceivedDate] = useState(localTodayISO)
  /** A time picked in the date card (`HH:mm`); '' = the current time, as the pill shows. */
  const [clock, setClock] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState(() => defaultMethodId(paymentMethods))
  const [notes, setNotes] = useState('')
  const [assigned, setAssigned] = useState<{ templateId: string; date: string } | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const n = noteRef.current
    if (!n) return
    n.style.height = 'auto'
    n.style.height = `${n.scrollHeight}px`
  }, [notes])

  const shownClock = clock || nowClock()
  const clockAt = mergeDayTime(receivedDate, shownClock)
  const datePill = `${formatDatePillLabel(receivedDate, locale, t.expenseForm.today)}${clockAt ? ` · ${formatClock(new Date(clockAt), locale)}` : ''}`
  const method = paymentMethods.find((m) => m.id === paymentMethodId)
  const assignedSource = assigned ? incomeSources.find((s) => s.id === assigned.templateId) : undefined
  const amt = parseFloat(amount)
  const valid = name.trim().length > 0 && !Number.isNaN(amt) && amt > 0
  const unsaved = Boolean(amount.trim() || name.trim() || notes.trim())

  const save = () => {
    if (!valid || !submitOnce.claim()) return
    addIncomeEvent({
      name: name.trim(),
      amount: amt,
      currency: clampFiatToAllowed(settings, currency),
      sourceType,
      // §8.0: linking picks the payday (occurrenceDate); receivedDate stays the real day.
      receivedDate,
      occurredAt: manualOccurredAt(receivedDate, clock),
      status: 'confirmed',
      notes: notes.trim() || undefined,
      ...(assigned ? { templateId: assigned.templateId, occurrenceDate: assigned.date } : {}),
      ...(paymentMethodId ? { paymentMethodId } : {}),
    })
    toast(t.common.toastIncomeAdded)
    onClose()
  }

  // Leaving with something typed (close, Escape, backdrop, swipe-down, Android back) asks to save or discard.
  const handleX = () => {
    if (unsaved) setConfirmOpen(true)
    else onClose()
  }
  useDismissGuard(() => {
    if (confirmOpen) {
      setConfirmOpen(false)
      return true
    }
    if (unsaved) {
      setConfirmOpen(true)
      return true
    }
    return false
  })

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        <V3SheetHeader
          onClose={handleX}
          leading={
            <PillButton icon={<Calendar />} onClick={() => setCalOpen(true)} aria-haspopup="dialog" aria-expanded={calOpen} className={HEADER_PILL}>
              <span dir="auto">{datePill}</span>
            </PillButton>
          }
        >
          <span className="sr-only">
            <V3SheetHeader.Title>{t.addIncome.sheetTitle}</V3SheetHeader.Title>
          </span>
        </V3SheetHeader>

        <div className={`min-h-0 flex-1 overflow-y-auto pb-4 ${HIDE_SCROLL}`}>
          <AmountHero
            id="ai-amt"
            aria-label={t.addIncome.labelAmount}
            value={amount}
            onChange={setAmount}
            currency={currency}
            onCurrencyChange={(c) => setCurrency(c as Currency)}
            base={settings.baseCurrency}
            sign="+"
            top={
              <span aria-hidden className="flex size-[52px] items-center justify-center rounded-[16px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                <IncomeTypeIcon type={sourceType} className="size-6" />
              </span>
            }
            line=""
            className="pb-0"
          />
          <div className="flex flex-col items-center px-5 pb-5 text-center">
            <input
              id="ai-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onCompositionUpdate={(e) => setName(e.currentTarget.value)}
              onCompositionEnd={(e) => setName(e.currentTarget.value)}
              aria-label={t.addIncome.labelSource}
              placeholder={t.addIncome.namePlaceholder}
              enterKeyHint="next"
              dir="auto"
              maxLength={120}
              className="w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
            <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{lt.income.lineOneTime}</p>
          </div>

          <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
            <PickerRow
              label={lt.income.type}
              onClick={() => setTypeOpen(true)}
              value={<span className="truncate">{incomeSourceTypeLabel(t.income, sourceType)}</span>}
            />
            <PickerRow
              label={lt.income.receivedIn}
              onClick={() => setMethodOpen(true)}
              value={method ? <MethodValue method={method} /> : <span className="font-semibold text-[var(--color-brand-primary-ink)]">{t.income.setAccount}</span>}
            />
            <PickerRow
              label={lt.income.payday}
              onClick={() => setAssignOpen(true)}
              value={
                assigned ? (
                  <span className="truncate">{[assignedSource?.name, shortDate(assigned.date)].filter(Boolean).join(' · ')}</span>
                ) : (
                  <span className="text-[var(--color-brand-text-muted)]">{lt.income.notLinked}</span>
                )
              }
            />
          </Card>

          <label className="mx-4 mt-3 flex min-h-12 items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3">
            <StickyNote className="mt-[3px] size-[18px] shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
            <textarea
              id="ai-notes"
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
        </div>

        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-6 pt-3">
          <Button type="button" onClick={save} disabled={!valid} size="cta-block" className="font-semibold">
            {lt.income.saveIncome}
          </Button>
        </div>
      </div>

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
      <AssignIncomeSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        credit={{ amount: valid ? amt : 0, currency, receivedDate }}
        onAssign={setAssigned}
        initialTemplateId={assigned?.templateId}
        zIndexClassName="z-[120]"
      />
      {calOpen ? (
        <UnifiedDatePicker
          open
          value={receivedDate}
          onConfirm={setReceivedDate}
          max={localTodayISO()}
          time={{ value: shownClock, label: lt.expense.time }}
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
        body={valid ? lt.income.unsavedAddBody : lt.expense.incompleteBody}
        saveLabel={lt.income.saveIncome}
        onSave={
          valid
            ? () => {
                setConfirmOpen(false)
                save()
              }
            : undefined
        }
        onDiscard={() => {
          setConfirmOpen(false)
          onClose()
        }}
        onKeep={() => setConfirmOpen(false)}
      />
    </>
  )
}
