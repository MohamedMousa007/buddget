'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, monthlyEquivalent, nextAwaitingIndex } from '@/lib/utils/incomeOccurrences'
import { RecurringIncomeCard } from '@/components/features/income/RecurringIncomeCard'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { GLASS_RED_BTN } from '@/components/features/income/incomeGlass'

const MON_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDay = (iso: string) => `${MON_TITLE[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

interface Props {
  open: boolean
  onClose: () => void
  /** Chosen source + payday. */
  onAssign: (result: { templateId: string; date: string }) => void
  /** Nested over the add modal needs a higher layer; the page opens it at the default. */
  zIndexClassName?: string
}

/**
 * Assign a receipt to a recurring source + payday (handoff §5). The same recurring
 * hero slider as the page: swipe between sources (red dots), the centred card shows
 * a green tick, and the next-awaiting payday is pre-selected with a soft green glow.
 * Controlled — the caller owns open state and applies the result (mirrors the app's
 * payment/currency sub-sheets so the sheet underneath stays mounted).
 */
export function AssignIncomeSheet({ open, onClose, onAssign, zIndexClassName }: Props) {
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
        const expectedBase = convertCurrency(monthlyEquivalent(source), source.currency, base, exchangeRates)
        const realizedBase = occ.reduce(
          (sum, o) => (o.status !== 'awaiting' && o.status !== 'missed' ? sum + convertCurrency(o.amount, o.currency, base, exchangeRates) : sum),
          0,
        )
        return { source, occ, expectedBase, realizedBase }
      }),
    [sources, incomeEvents, monthFilter, settings.monthStartDay, base, exchangeRates],
  )

  const [active, setActive] = useState(0)
  const [selKey, setSelKey] = useState<string | null>(null)
  const prevOpen = useRef(false)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset to the first source on open */
    if (open && !prevOpen.current) setActive(0)
    prevOpen.current = open
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open])

  const activeCard = cards[active]
  // Default the selected payday to the next awaiting one whenever the active source changes.
  useEffect(() => {
    if (!activeCard) return
    const idx = nextAwaitingIndex(activeCard.occ)
    const def = activeCard.occ[idx >= 0 ? idx : 0]
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the centred card
    setSelKey(def ? def.key : null)
  }, [activeCard])

  useEscapeClose(open, onClose)

  const accountLabel = (pmId?: string) => paymentMethods.find((m) => m.id === pmId)?.name ?? t.income.mainAccount
  const secondaryOf = (amountBase: number) =>
    settings.showSecondaryCurrency && settings.secondaryCurrency
      ? `≈ ${formatCurrency(convertCurrency(amountBase, base, settings.secondaryCurrency, exchangeRates), settings.secondaryCurrency, false)}`
      : null

  const selOcc = activeCard?.occ.find((o) => o.key === selKey) ?? null

  const confirm = () => {
    if (!activeCard || !selOcc) return
    onAssign({ templateId: activeCard.source.id, date: selOcc.date })
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
              const freq = source.recurringFrequency ?? 'monthly'
              const cad = freq === 'weekly' ? t.addIncome.freqWeekly : freq === 'biweekly' ? t.addIncome.freqBiweekly : `${t.addIncome.freqMonthly} · day ${source.dayOfMonth ?? 1}`
              return (
                <RecurringIncomeCard
                  sourceType={source.sourceType}
                  name={source.name}
                  cadenceLine={`${cad} · ${accountLabel(source.paymentMethodId)}`}
                  expectedBig={fmtNum(expectedBase)}
                  expectedCurrency={base}
                  expectedSecondary={secondaryOf(expectedBase)}
                  progressPct={expectedBase > 0 ? (realizedBase / expectedBase) * 100 : 0}
                  progressLine={
                    <>
                      {t.income.receivedOfExpected(`${fmtNum(realizedBase)} ${base}`, `${fmtNum(expectedBase)} ${base}`)}
                      {' · '}
                      {remaining <= 0 ? <span className="text-[#35D46F]">{t.income.fullyReceived}</span> : t.income.toCome(`${fmtNum(remaining)} ${base}`)}
                    </>
                  }
                  occurrences={occ}
                  chipLabel={(o) => fmtDay(o.date)}
                  glowKey={isActive ? selKey : null}
                  showTick={isActive}
                  onChipTap={isActive ? (o) => setSelKey(o.key) : undefined}
                  footer={<p className="text-center text-[11px] text-white/55">{isActive && selOcc ? t.income.fillsPayday(fmtDay(selOcc.date)) : ''}</p>}
                />
              )
            }}
          />
        </div>

        <button type="button" onClick={confirm} disabled={!selOcc} className="mt-5 w-full py-3 text-sm font-bold disabled:opacity-50" style={GLASS_RED_BTN}>
          {selOcc ? t.income.assignConfirm(activeCard.source.name, fmtDay(selOcc.date)) : t.income.assignTitle}
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
        if (assignTarget?.eventId) updateIncomeEvent(assignTarget.eventId, { templateId, receivedDate: date, status: 'confirmed' })
      }}
    />
  )
}
