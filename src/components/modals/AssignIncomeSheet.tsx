'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { convertCurrency, fmtCompact } from '@/lib/utils/currency'
import { expectedRecurringForMonth, getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, isRealizedOccurrence, nextAwaitingIndex, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { RecurringIncomeCard } from '@/components/features/income/RecurringIncomeCard'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { AccountChip } from '@/components/features/income/AccountChip'

const MON_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDay = (iso: string) => `${MON_TITLE[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

interface Props {
  open: boolean
  onClose: () => void
  /** Chosen source + payday (`date` = scheduled payday it fulfills). */
  onAssign: (result: { templateId: string; date: string }) => void
  /** Preselect a source (its card shows a tick on open), when already assigned. */
  initialTemplateId?: string
  /** Nested over the add modal needs a higher layer; the page opens it at the default. */
  zIndexClassName?: string
}

/**
 * Assign a receipt to a recurring source (handoff §5). Swipe between sources; like
 * the payment-method picker, no card is ticked until you tap one to choose it. The
 * chosen card shows a tick and its next-awaiting payday fills; the CTA names the
 * source (the payday is shown in the card caption, not the button).
 */
export function AssignIncomeSheet({ open, onClose, onAssign, initialTemplateId, zIndexClassName }: Props) {
  const { incomeSources, incomeEvents, paymentMethods, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const t = useT()
  const base = settings.baseCurrency

  const sources = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, settings.monthStartDay)
    return incomeSources.filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
  }, [incomeSources, monthFilter, settings.monthStartDay])

  const cards = useMemo(
    () =>
      sources.map((source) => {
        const occ = buildOccurrences(source, incomeEvents, monthFilter, settings.monthStartDay)
        const expectedBase = convertCurrency(expectedRecurringForMonth(source, monthFilter, settings.monthStartDay), source.currency, base, exchangeRates)
        const realizedBase = occ.reduce(
          (sum, o) => (isRealizedOccurrence(o) ? sum + convertCurrency(o.amount, o.currency, base, exchangeRates) : sum),
          0,
        )
        return { source, occ, expectedBase, realizedBase }
      }),
    [sources, incomeEvents, monthFilter, settings.monthStartDay, base, exchangeRates],
  )

  const [active, setActive] = useState(0)
  // Nothing is chosen until the user taps a card (like the payment-method picker).
  const [chosen, setChosen] = useState<string | null>(null)
  const [paydayKey, setPaydayKey] = useState<string | null>(null)
  const prevOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- seed selection when the sheet opens */
    if (open && !prevOpen.current) {
      const idx = initialTemplateId ? sources.findIndex((s) => s.id === initialTemplateId) : -1
      setActive(idx >= 0 ? idx : 0)
      setChosen(initialTemplateId ?? null)
      setPaydayKey(null)
    }
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialTemplateId, sources])

  const activeCard = cards[active]
  useEscapeClose(open, onClose)

  const accountLabel = (pmId?: string) => paymentMethods.find((m) => m.id === pmId)?.name ?? t.income.mainAccount

  const chosenCard = chosen ? cards.find((c) => c.source.id === chosen) ?? null : null
  // The payday the receipt fills: an explicit dot tap, else the chosen source's next awaiting.
  const targetOcc = useMemo(() => {
    if (!chosenCard) return null
    const explicit = paydayKey ? chosenCard.occ.find((o) => o.key === paydayKey) : null
    if (explicit) return explicit
    const idx = nextAwaitingIndex(chosenCard.occ)
    return chosenCard.occ[idx >= 0 ? idx : 0] ?? null
  }, [chosenCard, paydayKey])

  const selectSource = (id: string) => {
    setChosen(id)
    setPaydayKey(null)
  }
  const statusBracket = (o: IncomeOccurrence): string =>
    o.status === 'late' ? ` ${t.income.bracketLate}` : o.status === 'missed' ? ` ${t.income.bracketMissed}` : o.status === 'partial' ? ` ${t.income.bracketPartial}` : ''

  const confirm = () => {
    if (!chosen || !targetOcc) return
    onAssign({ templateId: chosen, date: targetOcc.dueDate })
    onClose()
  }

  if (!open || cards.length === 0 || !activeCard) return null

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName ?? 'z-[110]'} padContent>
      <div className="pt-1">
        <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.income.assignTitle}</h2>
        <p className="mt-1 text-xs text-[var(--color-brand-text-muted)]">{t.income.assignSubtitle}</p>

        <div className="mt-4">
          <RecurringIncomeCarousel
            count={cards.length}
            activeIndex={active}
            onActiveChange={setActive}
            renderItem={(i) => {
              const { source, occ, expectedBase, realizedBase } = cards[i]
              const remaining = Math.round(expectedBase - realizedBase)
              const isActive = i === active
              const isChosen = chosen === source.id
              const freq = source.recurringFrequency ?? 'monthly'
              const cad = freq === 'weekly' ? t.addIncome.freqWeekly : freq === 'biweekly' ? t.addIncome.freqBiweekly : `${t.addIncome.freqMonthly} · ${source.dayOfMonth ?? 1}`
              const acct = accountLabel(source.paymentMethodId)
              return (
                <RecurringIncomeCard
                  sourceType={source.sourceType}
                  name={source.name}
                  cadenceLine={cad}
                  paymentLine={<AccountChip label={acct} acct={{ paymentMethodId: source.paymentMethodId }} paymentMethods={paymentMethods} />}
                  expectedBig={fmtNum(expectedBase)}
                  expectedCurrency={base}
                  expectedTag={t.income.expectedPerMoLabel}
                  progressPct={expectedBase > 0 ? (realizedBase / expectedBase) * 100 : 0}
                  progressLine={
                    <>
                      {t.income.receivedOfExpected(`${fmtCompact(realizedBase)} ${base}`, `${fmtCompact(expectedBase)} ${base}`)}
                      {' · '}
                      {remaining <= 0 ? <span className="text-[#35D46F]">{t.income.fullyReceived}</span> : t.income.toCome(`${fmtCompact(remaining)} ${base}`)}
                    </>
                  }
                  occurrences={occ}
                  dateLabel={(o) => fmtDay(o.date)}
                  amountLabel={(o) => `${fmtCompact(o.amount)} ${o.currency}`}
                  statusBracket={statusBracket}
                  selectedKey={isChosen ? targetOcc?.key ?? null : null}
                  showTick={isChosen}
                  onCardTap={isActive ? () => selectSource(source.id) : undefined}
                  onChipTap={isActive ? (o) => { setChosen(source.id); setPaydayKey(o.key) } : undefined}
                  footer={<p className="w-full text-center text-[11px] text-white/55">{isChosen && targetOcc ? t.income.fillsPayday(fmtDay(targetOcc.date)) : t.income.assignTapHint}</p>}
                />
              )
            }}
          />
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={!chosen || !targetOcc}
          className="mt-5 w-full rounded-[14px] bg-[var(--color-brand-red)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-red-hover)] disabled:opacity-50"
        >
          {chosenCard ? t.income.assignConfirm(chosenCard.source.name) : t.income.assignTitle}
        </button>
      </div>
    </ModalShell>
  )
}

/**
 * Page/global mount: driven by `activeModal === 'assignIncome'` for row-swipe
 * assign, where the chosen payday is written straight to the existing event.
 */
export function GlobalAssignIncomeSheet() {
  const updateIncomeEvent = useFinanceStore((s) => s.updateIncomeEvent)
  const { activeModal, setActiveModal, assignTarget } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal, assignTarget: s.assignTarget })),
  )
  const open = activeModal === 'assignIncome' && !!assignTarget?.eventId
  return (
    <AssignIncomeSheet
      open={open}
      onClose={() => setActiveModal(null)}
      onAssign={({ templateId, date }) => {
        // `date` is the scheduled payday — stamp it as occurrenceDate so the
        // assigned event joins the dedupe pairing; receivedDate keeps the payday
        // too (legacy behavior for the ledger's day grouping).
        if (assignTarget?.eventId) updateIncomeEvent(assignTarget.eventId, { templateId, receivedDate: date, occurrenceDate: date, status: 'confirmed' })
      }}
    />
  )
}
