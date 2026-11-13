'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useSmsCounterparty } from '@/hooks/useSmsCounterparty'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { paydayCandidates } from '@/lib/income/paydayResolution'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { formatFixed2, formatFlex } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { fillSlots } from '@/lib/ui/fillSlots'
import { useT } from '@/lib/i18n'
import type { IncomeEvent } from '@/lib/store/types'

/** How many open paydays to offer; the best match is always first. */
const MAX_OPTIONS = 4
const NONE = 'none'

interface Props {
  open: boolean
  onClose: () => void
  /** The money being linked. Its date is kept — only the payday it fulfils is chosen here. */
  credit: Pick<IncomeEvent, 'amount' | 'currency' | 'receivedDate'>
  /** Chosen source + the scheduled payday (`date`) this credit fulfils. */
  onAssign: (result: { templateId: string; date: string }) => void
  /** Preselect a source's payday (it was linked before). */
  initialTemplateId?: string
  /** Nested over the add sheet needs a higher layer; the page opens it at the default. */
  zIndexClassName?: string
  /** Who sent it, when known (SMS credits): "… from AL RAJHI arrived on …". */
  from?: string | null
}

/**
 * Link to a payday (screen 13): "Which payday is this?" with the open paydays as radio
 * cards, best match first, and "None: keep it as one-time income". The word "assign" is
 * never shown. Linking writes the payday as `occurrenceDate` and never touches the credit's
 * `receivedDate` (§8.0), so a late payday still reads as late.
 */
export function AssignIncomeSheet({ open, onClose, credit, onAssign, initialTemplateId, zIndexClassName, from }: Props) {
  const shortDate = useShortDate()
  const t = useT()
  const { incomeSources, incomeEvents, monthStartDay, rates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      monthStartDay: s.settings.monthStartDay,
      rates: s.exchangeRates,
    })),
  )
  const weekendFirst = useWeekendFirstDay()
  const options = useMemo(
    () => (open ? paydayCandidates(credit, incomeSources, incomeEvents, monthStartDay, rates, new Date(), weekendFirst).slice(0, MAX_OPTIONS) : []),
    [open, credit, incomeSources, incomeEvents, monthStartDay, rates, weekendFirst],
  )
  const [chosen, setChosen] = useState<string>(NONE)
  const prevOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- seed the choice when the sheet opens */
    if (open && !prevOpen.current) {
      const pre = options.find((o) => o.source.id === initialTemplateId) ?? options.find((o) => o.plausible)
      setChosen(pre?.occ.key ?? NONE)
    }
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, options, initialTemplateId])
  useEscapeClose(open, onClose)

  const pick = options.find((o) => o.occ.key === chosen)
  const bestKey = options.find((o) => o.plausible)?.occ.key

  const confirm = () => {
    if (pick) onAssign({ templateId: pick.source.id, date: pick.occ.dueDate })
    onClose()
  }

  const body = fillSlots(from ? t.income.linkSheetBodyFrom : t.income.linkSheetBody, {
    from: from ?? '',
    amount: <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatFixed2(credit.amount)}</b>,
    currency: credit.currency,
    date: <b>{shortDate(credit.receivedDate)}</b>,
  })

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName ?? 'z-[110]'}>
      <div className="flex flex-col gap-3 px-4 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
        <V3SheetHeader title={t.income.linkSheetTitle} subtitle={body} onClose={onClose} />
        <div role="radiogroup" aria-label={t.income.linkSheetTitle} className="flex flex-col gap-3">
          {options.map((o) => (
            <SelectableCard key={o.occ.key} surface="elevated" selected={chosen === o.occ.key} onClick={() => setChosen(o.occ.key)}>
              <span className="flex w-full items-center gap-3 text-start">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                  <IncomeTypeIcon type={o.source.sourceType} className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.90625rem] font-bold text-[var(--color-brand-text-primary)]">{o.source.name}</span>
                  <span className="text-[0.78125rem] text-[var(--color-brand-text-secondary)]">
                    {t.income.linkOptionSub(shortDate(o.occ.dueDate), formatFlex(o.occ.amount))}
                    {o.plausible ? ` · ${t.income.offPct(Math.round(o.diff * 100))}` : ''}
                  </span>
                </span>
                {o.occ.key === bestKey ? (
                  <Badge variant="brand" size="xs">
                    {t.income.bestMatch}
                  </Badge>
                ) : null}
              </span>
            </SelectableCard>
          ))}
          <SelectableCard surface="elevated" selected={chosen === NONE} onClick={() => setChosen(NONE)}>
            <span className="flex w-full items-center gap-3 text-start">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                <IncomeTypeIcon type="other" className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[0.90625rem] font-bold text-[var(--color-brand-text-primary)]">{t.income.linkNone}</span>
                <span className="text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{t.income.linkNoneSub}</span>
              </span>
            </span>
          </SelectableCard>
        </div>
        <Button size="cta-block" onClick={confirm}>
          {pick
            ? t.income.linkCta(shortDate(pick.occ.dueDate), incomeSourceTypeLabel(t.income, pick.source.sourceType).toLowerCase())
            : t.prompts.keepSeparate}
        </Button>
        <Button variant="outline" size="cta-block" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </div>
    </ModalShell>
  )
}

/**
 * Global mount, driven by `activeModal === 'assignIncome'` — the row's "Link to a payday",
 * its swipe shortcut, and the detail sheet. Writes straight to the existing event.
 */
export function GlobalAssignIncomeSheet() {
  const { incomeEvents, updateIncomeEvent } = useFinanceStore(
    useShallow((s) => ({ incomeEvents: s.incomeEvents, updateIncomeEvent: s.updateIncomeEvent })),
  )
  const { activeModal, setActiveModal, assignTarget } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal, assignTarget: s.assignTarget })),
  )
  const event = assignTarget?.eventId ? incomeEvents.find((e) => e.id === assignTarget.eventId) : undefined
  const from = useSmsCounterparty(event?.smsLogId)
  if (!event) return null
  return (
    <AssignIncomeSheet
      open={activeModal === 'assignIncome'}
      onClose={() => setActiveModal(null)}
      credit={event}
      from={from}
      // §8.0: the payday goes on occurrenceDate; receivedDate stays the day it arrived.
      onAssign={({ templateId, date }) => updateIncomeEvent(event.id, { templateId, occurrenceDate: date, status: 'confirmed' })}
    />
  )
}
