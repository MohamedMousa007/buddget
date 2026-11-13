'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { isRealizedOccurrence, missedAfterDaysFor, pendingStatus, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { toISODate } from '@/lib/utils/paydaySchedule'
import { formatFixed2, formatFlex } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { overdueDays, isLate } from '@/lib/income/paydaySummary'
import { fillSlots } from '@/lib/ui/fillSlots'
import { useT } from '@/lib/i18n'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

const REALIZED = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])
const DAY = 86_400_000

type ActionState = 'untouched' | 'received' | 'missedRecent' | 'missedPast' | 'notYet'

/**
 * The payday action state machine (BEHAVIOR.md), for the payday selected on the timeline:
 * untouched → Received · Missed (+ link another transaction); received → Edit · Delete;
 * marked missed → Awaiting · Received while the next payday hasn't passed, then Received
 * only; a payday not in turn yet → a note to settle the earlier one first.
 */
export function PaydayActionsCard({ source, occ }: { source: IncomeSource; occ: IncomeOccurrence }) {
  const shortDate = useShortDate()
  const t = useT()
  const toast = useActionToast()
  const confirm = useConfirm()
  const { incomeEvents, addIncomeEvent, deleteIncomeEvent, restoreIncomeEvent } = useFinanceStore(
    useShallow((s) => ({ incomeEvents: s.incomeEvents, addIncomeEvent: s.addIncomeEvent, deleteIncomeEvent: s.deleteIncomeEvent, restoreIncomeEvent: s.restoreIncomeEvent })),
  )
  const openAmountReceived = useSettingsStore((s) => s.openAmountReceived)
  const [linking, setLinking] = useState(false)
  const today = new Date()
  const todayISO = toISODate(today)
  const month = occ.dueDate.slice(0, 7)
  const event = occ.eventId ? incomeEvents.find((e) => e.id === occ.eventId) : undefined

  const state: ActionState = !occ.actionable
    ? 'notYet'
    : isRealizedOccurrence(occ)
      ? 'received'
      : occ.eventId && occ.status === 'missed'
        ? pendingStatus(occ.dueDate, todayISO, missedAfterDaysFor(source)) === 'missed'
          ? 'missedPast'
          : 'missedRecent'
        : 'untouched'

  const late = isLate(source, occ, today)
  const badge =
    state === 'received'
      ? occ.daysLate
        ? { variant: 'warning' as const, label: t.income.daysLateChip(occ.daysLate) }
        : occ.status === 'partial'
          ? { variant: 'brand' as const, label: t.income.statusPartial }
          : { variant: 'positive' as const, label: t.income.statusReceived }
      : state === 'missedRecent' || state === 'missedPast'
        ? { variant: 'muted' as const, label: t.income.statusMissed }
        : late || overdueDays(occ, today) > 0
          ? { variant: 'warning' as const, label: t.income.daysLateChip(overdueDays(occ, today)) }
          : { variant: 'muted' as const, label: t.paydays.dueOn(shortDate(occ.dueDate)) }

  const amountSlot = <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatFixed2(occ.amount)}</b>
  const body =
    state === 'received'
      ? fillSlots(t.paydays.receivedBody, { amount: amountSlot, currency: occ.currency, date: shortDate(event?.receivedDate ?? occ.dueDate) })
      : state === 'missedRecent' || state === 'missedPast'
        ? t.paydays.missedBody
        : state === 'notYet'
          ? t.income.earlierPaydayFirst
          : fillSlots(occ.dueDate < todayISO ? t.paydays.untouchedBody : t.paydays.dueBody, { amount: amountSlot, currency: occ.currency })

  const received = () => openAmountReceived(source.id, occ.key, month)
  const markMissed = () =>
    addIncomeEvent({
      templateId: source.id,
      name: source.name,
      amount: source.amount,
      currency: source.currency,
      sourceType: source.sourceType,
      receivedDate: occ.dueDate,
      occurrenceDate: occ.dueDate,
      status: 'missed',
      ...(source.paymentMethodId ? { paymentMethodId: source.paymentMethodId } : {}),
    })
  const remove = async () => {
    if (!event || !(await confirm({ title: t.paydays.confirmDeleteEntry, destructive: true }))) return
    deleteIncomeEvent(event.id)
    toast(t.paydays.deleted, {
      undo: () => {
        if (!restoreIncomeEvent(event)) toast(t.moneyFlows.undoPocketSpent)
      },
      undoLabel: t.common.undo,
    })
  }

  return (
    <div className="mx-4 mt-3.5 flex flex-col gap-2.5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{t.paydays.paydayTitle(shortDate(occ.dueDate))}</span>
        <Badge variant={badge.variant} size="xs">
          {badge.label}
        </Badge>
      </div>
      <p className="text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-secondary)]">{body}</p>
      {state === 'untouched' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" size="cta" onClick={received}>
              {t.income.receivedBtn}
            </Button>
            <Button variant="outline" size="cta" onClick={markMissed}>
              {t.income.missedBtn}
            </Button>
          </div>
          <Button variant="link" size="touch" onClick={() => setLinking(true)}>
            {t.paydays.linkOther}
          </Button>
        </>
      ) : state === 'received' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="cta" onClick={received}>
            {t.common.edit}
          </Button>
          <Button variant="destructive" size="cta" onClick={() => void remove()}>
            {t.common.delete}
          </Button>
        </div>
      ) : state === 'missedRecent' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="cta" onClick={() => event && deleteIncomeEvent(event.id)}>
            {t.income.awaitingBtn}
          </Button>
          <Button variant="success" size="cta" onClick={received}>
            {t.income.receivedBtn}
          </Button>
        </div>
      ) : state === 'missedPast' ? (
        <Button variant="success" size="cta-block" onClick={received}>
          {t.income.receivedBtn}
        </Button>
      ) : null}
      <LinkCreditSheet open={linking} onClose={() => setLinking(false)} source={source} occ={occ} />
    </div>
  )
}

/**
 * "It arrived in another transaction": pick the unlinked credit that was this payday. The
 * credit keeps its own date (§8.0) — only the payday it fulfils is written.
 */
function LinkCreditSheet({ open, onClose, source, occ }: { open: boolean; onClose: () => void; source: IncomeSource; occ: IncomeOccurrence }) {
  const shortDate = useShortDate()
  const t = useT()
  const { incomeEvents, updateIncomeEvent } = useFinanceStore(
    useShallow((s) => ({ incomeEvents: s.incomeEvents, updateIncomeEvent: s.updateIncomeEvent })),
  )
  const [chosen, setChosen] = useState<string | null>(null)
  const credits = useMemo(() => {
    const due = parseISO(occ.dueDate).getTime()
    return incomeEvents
      .filter((e) => !e.templateId && REALIZED.has(e.status) && !e.linkedDebtId && !e.linkedSavingsAccountId)
      .map((e) => ({ e, dist: Math.abs(parseISO(e.receivedDate).getTime() - due) / DAY }))
      .filter((c) => c.dist <= 45)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
      .map((c) => c.e)
  }, [incomeEvents, occ.dueDate])

  const close = () => {
    setChosen(null)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={close} padContent>
      <div className="flex flex-col gap-3">
        <V3SheetHeader title={t.paydays.pickCreditTitle} subtitle={t.paydays.pickCreditBody} onClose={close} />
        {credits.length ? (
          <div role="radiogroup" aria-label={t.paydays.pickCreditTitle} className="flex flex-col gap-3">
            {credits.map((e) => (
              <SelectableCard key={e.id} surface="elevated" selected={chosen === e.id} onClick={() => setChosen(e.id)}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                  <IncomeTypeIcon type={e.sourceType} className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
                  <span className="truncate text-[0.90625rem] font-bold text-[var(--color-brand-text-primary)]">{e.name}</span>
                  <span className="font-mono-numbers text-[0.78125rem] text-[var(--color-brand-text-secondary)]">
                    {shortDate(e.receivedDate)} · {formatFlex(e.amount)} {e.currency}
                  </span>
                </span>
              </SelectableCard>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--color-brand-text-muted)]">{t.paydays.pickCreditEmpty}</p>
        )}
        <Button
          size="cta-block"
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return
            updateIncomeEvent(chosen, { templateId: source.id, occurrenceDate: occ.dueDate, status: 'confirmed' })
            close()
          }}
        >
          {t.paydays.pickCreditCta}
        </Button>
        <Button variant="outline" size="cta-block" onClick={close}>
          {t.common.cancel}
        </Button>
      </div>
    </ModalShell>
  )
}
