'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { localTodayISO } from '@/lib/utils/localDate'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { adoptedPaydayAccount, paydayLogMethodId } from '@/lib/income/paydayHero'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT, useLocale } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { buildOccurrences, expectedPerPayday } from '@/lib/utils/incomeOccurrences'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { AmountHero } from '@/components/ui/AmountHero'
import { PickerRow } from '@/components/ui/PickerRow'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { parseISO } from 'date-fns'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup, TxTile } from '@/components/features/debts/lt/SheetParts'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { clockOf, editedOccurredAt, manualOccurredAt } from '@/lib/time/occurredAt'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { OptionChip } from '@/components/ui/OptionChip'
import { parseLocalizedAmount } from '@/lib/ui/amountParse'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'

const todayISO = () => localTodayISO()

/**
 * Amount-received sheet (handoff §4). Prefilled to the expected per-payday; the
 * input colour is meaningful (white → green when it meets/exceeds expected → blue
 * when partial). Save derives the status from the amount. The received date defaults
 * to today but is editable: a backfilled payday logged months later would otherwise
 * read as months late, since the drift chip measures received-minus-payday.
 * This one sheet handles both Received and Partial.
 */
export function AmountReceivedSheet() {
  const showToast = useActionToast()
  const { incomeSources, incomeEvents, addIncomeEvent, updateIncomeEvent, updateIncomeSource, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      addIncomeEvent: s.addIncomeEvent,
      updateIncomeEvent: s.updateIncomeEvent,
      updateIncomeSource: s.updateIncomeSource,
      paymentMethods: s.paymentMethods,
    })),
  )
  const { activeModal, setActiveModal, markingIncome, monthFilter } = useSettingsStore(
    useShallow((s) => ({
      activeModal: s.activeModal,
      setActiveModal: s.setActiveModal,
      markingIncome: s.markingIncome,
      monthFilter: s.monthFilter,
    })),
  )
  const monthStartDay = useFinanceStore((s) => s.settings.monthStartDay)
  const t = useT()
  const lt = useDebtsSubsLtCopy().received
  const { locale } = useLocale()
  const isOpen = activeModal === 'amountReceived' && !!markingIncome

  const source = markingIncome ? incomeSources.find((s) => s.id === markingIncome.sourceId) : undefined
  const weekendFirst = useWeekendFirstDay()
  const occ = useMemo(
    () => (source ? buildOccurrences(source, incomeEvents, markingIncome?.month ?? monthFilter, monthStartDay, new Date(), weekendFirst) : []),
    [source, incomeEvents, markingIncome?.month, monthFilter, monthStartDay, weekendFirst],
  )
  const current = markingIncome ? occ.find((o) => o.key === markingIncome.occKey) : undefined
  const expected = source ? expectedPerPayday(source) : 0
  const currency = source?.currency ?? 'EGP'

  // Belt-and-braces dedupe: even if the occurrence pairing missed it, an event
  // already stamped for this payday means we UPDATE, never add a second row.
  const targetEventId =
    current?.eventId ??
    (source && current
      ? incomeEvents.find((e) => e.templateId === source.id && e.occurrenceDate === current.dueDate)?.id
      : undefined)
  const isEdit = Boolean(targetEventId)
  /** The date already on file for this payday — the prefill, and the baseline for `unchanged`. */
  const currentReceivedDate = targetEventId
    ? incomeEvents.find((e) => e.id === targetEventId)?.receivedDate ?? null
    : null
  const saved = targetEventId ? incomeEvents.find((e) => e.id === targetEventId) : undefined
  /** The stored time of the row being updated ('' for none, or the "no time" stand-in). */
  const savedClock = saved ? clockOf(saved.occurredAt, saved.receivedDate) : ''

  const [amount, setAmount] = useState('')
  const [receivedDate, setReceivedDate] = useState(todayISO)
  const [clock, setClock] = useState('')
  const timeLabel = useFlowLtCopy().expense.time
  const [methodId, setMethodId] = useState('')
  const prevOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- prefill when the sheet opens */
    if (isOpen && !prevOpen.current) {
      setAmount(current ? String(current.amount) : '')
      // A payday still in the future can only have been received early or today; anything
      // already logged keeps the date it was logged with.
      setReceivedDate(currentReceivedDate ?? todayISO())
      setClock(savedClock)
      // A logged payday reopens on the account it landed in; a new one on the payday's own account.
      setMethodId(paydayLogMethodId(saved, source, paymentMethods))
    }
    prevOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, current, currentReceivedDate, savedClock, saved, source, paymentMethods])

  const close = () => setActiveModal(null)
  useEscapeClose(isOpen, close)

  const amt = parseLocalizedAmount(amount, currency)
  const valid = !Number.isNaN(amt) && amt > 0
  const meetsExpected = valid && amt >= expected
  const short = Math.max(0, Math.round(expected - (valid ? amt : 0)))

  // Re-marking a settled payday with the same amount is a no-op — keep the CTA dimmed.
  // But a MISSED payday is not settled: receiving it flips status missed → confirmed even
  // at the same amount (markPaydayMissed stores the full expected amount), so it must never
  // count as unchanged — otherwise the only way to enable Save is to enter a *different*,
  // necessarily partial, amount, and the full amount can never be received.
  const unchanged =
    isEdit &&
    valid &&
    !!current &&
    amt === current.amount &&
    receivedDate === currentReceivedDate &&
    clock === savedClock &&
    current.status !== 'missed'
  const blocked = !!current && !current.actionable && !isEdit
  const savingRef = useRef(false)

  // A changed or cleared time is sent as picked; a row with no time yet, received today, carries the moment it is logged.
  const updatedOccurredAt = (): { occurredAt?: string } => {
    const edited = saved ? editedOccurredAt(receivedDate, clock, { day: saved.receivedDate, clock: savedClock }) : undefined
    if (edited) return { occurredAt: edited }
    return !savedClock && !clock && receivedDate === localTodayISO() ? { occurredAt: new Date().toISOString() } : {}
  }

  const save = () => {
    if (!valid || !source || !current || blocked || savingRef.current) return
    savingRef.current = true
    const status = meetsExpected ? 'confirmed' : 'partial'
    if (targetEventId) {
      // A picked time, or marked received today: carry the exact time, as a new entry does, so the balance counts it at once.
      updateIncomeEvent(targetEventId, { amount: amt, status, receivedDate, occurrenceDate: current.dueDate, ...(methodId ? { paymentMethodId: methodId } : {}), ...updatedOccurredAt() })
    } else {
      addIncomeEvent({
        templateId: source.id,
        name: source.name,
        amount: amt,
        currency,
        sourceType: source.sourceType,
        receivedDate,
        occurredAt: manualOccurredAt(receivedDate, clock),
        occurrenceDate: current.dueDate,
        status,
        ...(methodId ? { paymentMethodId: methodId } : {}),
      })
    }
    const adopted = adoptedPaydayAccount(source, methodId, paymentMethods)
    if (adopted) updateIncomeSource(source.id, { paymentMethodId: adopted })
    showToast(t.common.toastIncomeAdded)
    close()
  }

  // Re-arm the guard each time the sheet opens.
  useEffect(() => {
    if (isOpen) savingRef.current = false
  }, [isOpen])

  if (!isOpen || !source || !current) return null

  const half = Math.round((expected / 2) * 100) / 100
  const freq = source.recurringFrequency === 'weekly' ? t.addIncome.freqWeekly : source.recurringFrequency === 'biweekly' ? t.addIncome.freqBiweekly : t.addIncome.freqMonthly

  return (
    <ModalShell open={isOpen} onBackdropClick={close} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={close} leading={<DatePickerField look="pill" value={receivedDate} onChange={setReceivedDate} time={{ value: clock, onChange: setClock, label: timeLabel, defaultNow: !isEdit }} />}>
          <span className="sr-only"><V3SheetHeader.Title>{t.income.amountReceivedTitle}</V3SheetHeader.Title></span>
        </V3SheetHeader>
        <div className="native-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
          <AmountHero
            value={amount}
            onChange={setAmount}
            currency={currency}
            sign="+"
            aria-label={t.income.amountReceivedLabel}
            top={<TxTile tone="var(--color-brand-green)"><IncomeTypeIcon type={source.sourceType} /></TxTile>}
            className="px-0 pb-0"
          />
          <div className="mt-2 flex flex-col items-center gap-3 text-center">
            <div>
              <p dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{lt.title(source.name, formatLocalized(parseISO(current.dueDate), 'MMMM', locale))}</p>
              <p dir="auto" className="mt-0.5 text-[0.8125rem]" style={{ color: !valid || meetsExpected ? 'var(--color-brand-text-secondary)' : 'var(--color-status-warn-fg)' }}>
                {!valid || meetsExpected ? lt.expected(fmtNum(expected)) : lt.short(`${fmtNum(short)} ${currency}`)}
              </p>
            </div>
            {expected > 0 ? (
              <div className="flex gap-2">
                <OptionChip size="sm" selected={valid && amt === expected} onClick={() => setAmount(String(expected))}>{lt.full(fmtNum(expected))}</OptionChip>
                <OptionChip size="sm" selected={valid && amt === half} onClick={() => setAmount(String(half))}>{lt.half(fmtNum(half))}</OptionChip>
              </div>
            ) : null}
          </div>
          <SheetGroup>
            {paymentMethods.length > 0 ? (
              <MethodPickerRow label={lt.receivedIn} value={methodId} onChange={setMethodId} paymentMethods={paymentMethods} accountsOnly />
            ) : null}
            <PickerRow label={lt.payday} value={<span dir="auto" className="truncate">{`${source.name} · ${freq.toLowerCase()}`}</span>} />
          </SheetGroup>
          {blocked ? <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{t.income.earlierPaydayFirst}</p> : null}
        </div>
        <div className="sheet-cta shrink-0 border-t border-[var(--color-brand-border)] px-5 pb-6 pt-3">
          <Button type="button" onClick={save} disabled={!valid || unchanged || blocked} size="cta-block">
            {isEdit ? t.income.saveChangesBtn : meetsExpected ? t.income.markReceivedBtn : t.income.saveAsPartialBtn}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
