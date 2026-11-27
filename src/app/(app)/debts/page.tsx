'use client'

import { countedDebts } from '@/lib/spending/exclusion'
import { PageGrid } from '@/components/layout/PageGrid'
import { PageHero } from '@/components/layout/PageHero'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ShieldCheck, Trophy } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { DebtPortfolioHero } from '@/components/features/debts/redesign/DebtPortfolioHero'
import { DebtFamilyTabs } from '@/components/features/debts/redesign/DebtFamilyTabs'
import { DebtsActiveList } from '@/components/features/debts/redesign/DebtsActiveList'
import { DebtDetailSheet } from '@/components/features/debts/redesign/DebtDetailSheet'
import { ClearedDebtsView, type NextToClear } from '@/components/features/debts/redesign/ClearedDebtsView'
import { AssignPaymentBanner, type AssignCandidate } from '@/components/features/debts/redesign/AssignPaymentBanner'
import { CardDetailSheet } from '@/components/features/accounts/CardDetailSheet'
import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { firstNonEmptyFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import { useMask } from '@/lib/privacy/useMask'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { OptionChip } from '@/components/ui/OptionChip'
import { AddDebtOptionSheet } from '@/components/features/debts/redesign/AddDebtOptionSheet'

type Detail = { id: string; readOnly: boolean }

export default function DebtsPage() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { settings, exchangeRates, debts, paymentMethods } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates, debts: s.debts, paymentMethods: s.paymentMethods })),
  )
  const { setActiveModal, setEditingDebtId, openDebtSheetNew, openDebtSheetRecordPayment } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const c = useDebtsSubsLtCopy().debts
  const v9 = useDebtsV9Copy().list
  const masked = useMask('lists')
  const data = useDebtTabData()

  const [tab, setTab] = useState<DebtFamily>('borrow')
  const [clearedView, setClearedView] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [editCardId, setEditCardId] = useState<string | null>(null)
  const [dismissedAssign, setDismissedAssign] = useState<string | null>(null)
  const pickedDefault = useRef(false)

  // Smart default: land on the first non-empty family (once, when data is ready).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time landing tab from store */
    if (pickedDefault.current || !dataReady) return
    pickedDefault.current = true
    { const st = useFinanceStore.getState(); setTab(firstNonEmptyFamily(countedDebts(st.debts, st.paymentMethods))) }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dataReady])

  // Hardware / gesture back leaves the Cleared page before leaving Debts.
  useEffect(() => {
    if (!clearedView) return
    return registerBackGuard(() => { setClearedView(false); return true })
  }, [clearedView])

  const secondaryText = useMemo(() => {
    if (!settings.showSecondaryCurrency || !settings.secondaryCurrency) return null
    return formatCurrency(convertCurrency(data.owed, data.base, settings.secondaryCurrency, exchangeRates), settings.secondaryCurrency)
  }, [settings.showSecondaryCurrency, settings.secondaryCurrency, data.owed, data.base, exchangeRates])

  const nextToClear = useMemo<NextToClear | null>(() => {
    const plans = data.installments.filter((p) => p.count > 0).map((p) => ({ id: p.id, name: p.item || p.providerName, paymentsLeft: Math.max(0, p.count - p.paid), pct: Math.round((p.paid / p.count) * 100) }))
    return plans.sort((a, b) => a.paymentsLeft - b.paymentsLeft)[0] ?? null
  }, [data.installments])

  const assignPayment = (a: AssignCandidate) =>
    requireAuth(() => (a.debtId ? openDebtSheetRecordPayment(a.debtId) : openDebtSheetNew('installment')), t.debts.requireAuthPayment)
  const pay = (id: string, full?: boolean) => requireAuth(() => openDebtSheetRecordPayment(id, full), t.debts.requireAuthPayment)
  const edit = (id: string) => { setEditingDebtId(id); setActiveModal('editDebt') }
  // A credit card opens the shared card sheet (Pay card, its plans); a card with no linked method falls back to Add payment.
  const open = (id: string, readOnly = false) => {
    const debt = debts.find((d) => d.id === id)
    if (debt?.debtType === 'credit_card') {
      const pm = paymentMethods.find((m) => m.id === debt.linkedPaymentMethodId)
      if (pm) setCardId(pm.id)
      else if (!readOnly) pay(id)
      return
    }
    setDetail({ id, readOnly })
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const noneActive = data.counts.borrow + data.counts.credit_card + data.counts.installment === 0
  const clearedCount = data.cleared.length
  // The empty page is the empty card alone (mockup state-emptydebts): no zero hero above it.
  const empty = noneActive && clearedCount === 0
  const card = cardId ? paymentMethods.find((m) => m.id === cardId) : undefined
  const editCard = editCardId ? paymentMethods.find((m) => m.id === editCardId) : undefined
  const parentOf = (pmId?: string | null) => (pmId ? paymentMethods.find((m) => m.id === pmId) : undefined)

  const sheets = (
    <>
      <AddDebtOptionSheet open={addOpen} onClose={() => setAddOpen(false)} />
      {detail ? <DebtDetailSheet key={detail.id} debtId={detail.id} readOnly={detail.readOnly} onClose={() => setDetail(null)} onPay={pay} onEdit={edit} /> : null}
      {card ? (
        <CardDetailSheet key={card.id} open card={card} parent={parentOf(card.parentId)} masked={masked} behind={editCard !== undefined} onClose={() => setCardId(null)} onEdit={() => setEditCardId(card.id)} />
      ) : null}
      {editCard ? (
        <PaymentMethodSetupSheet key={`e-${editCard.id}`} open editing={editCard} baseCurrency={settings.baseCurrency} nested onClose={() => setEditCardId(null)} />
      ) : null}
    </>
  )

  if (clearedView) {
    return (
      <div className="mx-auto w-full max-w-[var(--page-max)] px-4 pb-6 pt-2 lg:px-6">
        <ClearedDebtsView cleared={data.cleared} base={data.base} next={nextToClear} onBack={() => setClearedView(false)} onOpen={(id) => open(id, id !== nextToClear?.id)} />
        {sheets}
      </div>
    )
  }

  return (
    <div>
      {empty ? null : (
      <PageHero inset>
      <DebtPortfolioHero
        owed={data.owed}
        base={data.base}
        secondaryText={secondaryText}
        clearedPct={data.clearedPct}
        borrowedTotal={data.borrowedTotal}
        activeCount={data.counts.borrow + data.counts.credit_card + data.counts.installment}
        nextPayment={data.nextPayment}
        overdue={data.overdue}
        dueThisMonth={data.dueThisMonth}
        paidThisMonth={data.paidThisMonth}
        debtFreeDate={data.debtFreeDate}
        unplannedCount={data.unplannedCount}
        lastClearedAt={data.lastClearedAt}
        paidOff={data.paidOff}
        clearedCount={clearedCount}
      />
      </PageHero>
      )}

      <PageGrid
          stack
          primary={
            <div className="px-4 pb-6 pt-4 lg:px-0 lg:pt-0">
                {empty ? (
                  <EmptyState
                    variant="card"
                    className="mt-5"
                    icon={<ShieldCheck strokeWidth={1.8} />}
                    iconTone="positive"
                    title={c.emptyTitle}
                    description={c.emptyBody}
                    action={<Button size="cta" className="w-full" onClick={() => setAddOpen(true)}>{c.emptyCta}</Button>}
                  />
                ) : (
                  <>
                    <div className="mt-1 flex items-center gap-2 lg:mt-0">
                      <div className="min-w-0 flex-1">
                        <DebtFamilyTabs active={tab} onChange={setTab} />
                      </div>
                      {clearedCount > 0 ? (
                        <OptionChip size="sm" surface="card" selected={false} onClick={() => setClearedView(true)} aria-label={v9.clearedAria(clearedCount)} className="h-[42px] flex-none">
                          <Trophy aria-hidden className="size-[18px]" />
                          <span className="font-mono-numbers">{clearedCount}</span>
                        </OptionChip>
                      ) : null}
                    </div>

                    {tab === 'installment' && data.assignCandidate && data.assignCandidate.id !== dismissedAssign ? (
                      <div className="mt-4">
                        <AssignPaymentBanner candidate={data.assignCandidate} onAssign={assignPayment} onDismiss={(id) => setDismissedAssign(id)} />
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <DebtsActiveList
                        family={tab}
                        borrow={data.borrow}
                        installments={data.installments}
                        cards={data.cards}
                        onAdd={() => setAddOpen(true)}
                        onOpen={(id) => open(id)}
                      />
                    </div>
                  </>
                )}
            </div>
          }
        />

      {sheets}
    </div>
  )
}
