'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { buildOccurrences, expectedPerPayday } from '@/lib/utils/incomeOccurrences'

const MON_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDay = (iso: string) => `${MON_TITLE[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * Amount-received sheet (handoff §4). Prefilled to the expected per-payday; the
 * input colour is meaningful (white → green when it meets/exceeds expected → blue
 * when partial). Save derives the status from the amount; confirming an awaiting
 * payday stamps it Today. This one sheet handles both Received and Partial.
 */
export function AmountReceivedSheet() {
  const showToast = useActionToast()
  const { incomeSources, incomeEvents, addIncomeEvent, updateIncomeEvent } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      addIncomeEvent: s.addIncomeEvent,
      updateIncomeEvent: s.updateIncomeEvent,
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
  const isOpen = activeModal === 'amountReceived' && !!markingIncome

  const source = markingIncome ? incomeSources.find((s) => s.id === markingIncome.sourceId) : undefined
  const occ = useMemo(
    () => (source ? buildOccurrences(source, incomeEvents, monthFilter, monthStartDay) : []),
    [source, incomeEvents, monthFilter, monthStartDay],
  )
  const current = markingIncome ? occ.find((o) => o.key === markingIncome.occKey) : undefined
  const expected = source ? expectedPerPayday(source) : 0
  const currency = source?.currency ?? 'EGP'

  const [amount, setAmount] = useState('')
  const prevOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- prefill when the sheet opens */
    if (isOpen && !prevOpen.current) {
      setAmount(current ? String(current.amount) : '')
    }
    prevOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, current])

  const close = () => setActiveModal(null)
  useEscapeClose(isOpen, close)

  const amt = parseFloat(amount)
  const valid = !Number.isNaN(amt) && amt > 0
  const meetsExpected = valid && amt >= expected
  const short = Math.max(0, Math.round(expected - (valid ? amt : 0)))
  // Input colour is meaningful: white while typing → green when it meets/exceeds
  // expected → blue (partial) when it is less (handoff §4).
  const inputColorDisplay = !valid ? '#FFFFFF' : meetsExpected ? '#35D46F' : '#7DB6FF'

  // Belt-and-braces dedupe: even if the occurrence pairing missed it, an event
  // already stamped for this payday means we UPDATE, never add a second row.
  const targetEventId =
    current?.eventId ??
    (source && current
      ? incomeEvents.find((e) => e.templateId === source.id && e.occurrenceDate === current.dueDate)?.id
      : undefined)
  const isEdit = Boolean(targetEventId)
  // Re-marking a settled payday with the same amount is a no-op — keep the CTA dimmed.
  const unchanged = isEdit && valid && !!current && amt === current.amount
  const blocked = !!current && !current.actionable && !isEdit
  const savingRef = useRef(false)

  const save = () => {
    if (!valid || !source || !current || blocked || savingRef.current) return
    savingRef.current = true
    const status = meetsExpected ? 'confirmed' : 'partial'
    if (targetEventId) {
      updateIncomeEvent(targetEventId, { amount: amt, status, occurrenceDate: current.dueDate })
    } else {
      addIncomeEvent({
        templateId: source.id,
        name: source.name,
        amount: amt,
        currency,
        sourceType: source.sourceType,
        receivedDate: todayISO(),
        occurrenceDate: current.dueDate,
        status,
        ...(source.paymentMethodId ? { paymentMethodId: source.paymentMethodId } : {}),
      })
    }
    showToast(t.common.toastIncomeAdded)
    close()
  }

  // Re-arm the guard each time the sheet opens.
  useEffect(() => {
    if (isOpen) savingRef.current = false
  }, [isOpen])

  if (!isOpen || !source || !current) return null

  return (
    <ModalShell open={isOpen} onBackdropClick={close} padContent>
      <div className="pt-1">
        <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.income.amountReceivedTitle}</h2>
        <p className="mt-1 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
          {t.income.amountSheetSubtitle(fmtDay(current.date), source.name, `${fmtNum(expected)} ${currency}`)}
        </p>

        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
          {t.income.amountReceivedLabel}
        </label>
        <div
          className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4"
          style={{ boxShadow: `inset 0 0 0 1px ${valid ? inputColorDisplay + '55' : 'transparent'}` }}
        >
          <span className="font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{currency}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className="w-full bg-transparent py-3.5 font-mono-numbers text-2xl font-bold outline-none"
            style={{ color: inputColorDisplay }}
          />
        </div>
        <p className="mt-2 font-mono-numbers text-xs" style={{ color: meetsExpected ? 'var(--color-brand-text-muted)' : '#FFB13D' }}>
          {!valid || meetsExpected ? t.income.matchesExpected : t.income.shortOfExpected(`${fmtNum(short)} ${currency}`, `${fmtNum(expected)} ${currency}`)}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={!valid || unchanged || blocked}
          className="mt-4 w-full rounded-[14px] bg-[var(--color-brand-green)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-green-hover)] disabled:opacity-50"
        >
          {isEdit ? t.income.saveChangesBtn : meetsExpected ? t.income.markReceivedBtn : t.income.saveAsPartialBtn}
        </button>
        {blocked ? (
          <p className="mt-2 text-center text-xs text-[var(--color-brand-text-muted)]">{t.income.earlierPaydayFirst}</p>
        ) : null}
      </div>
    </ModalShell>
  )
}
