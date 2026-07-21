'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { DebtPortfolioHero } from '@/components/features/debts/redesign/DebtPortfolioHero'
import { DebtFamilyTabs } from '@/components/features/debts/redesign/DebtFamilyTabs'
import { BorrowHeroCard } from '@/components/features/debts/redesign/BorrowHeroCard'
import { CreditCardHeroCard } from '@/components/features/debts/redesign/CreditCardHeroCard'
import { InstallmentHeroCard } from '@/components/features/debts/redesign/InstallmentHeroCard'
import { DebtPaymentsFeed } from '@/components/features/debts/redesign/DebtPaymentsFeed'
import { ClearedVaultSheet } from '@/components/features/debts/redesign/ClearedVaultSheet'
import { ChargesSheet, type ChargesSheetTarget } from '@/components/features/debts/redesign/ChargesSheet'
import { AssignPaymentBanner } from '@/components/features/debts/redesign/AssignPaymentBanner'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { firstNonEmptyFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateDebts, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'

const FAMILY_LABEL: Record<DebtFamily, string> = {
  borrow: 'Borrow',
  credit_card: 'Your cards',
  installment: 'Installment plans',
}

export default function DebtsPage() {
  useHydrateDebts()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates })),
  )
  const { activeModal, setActiveModal, setEditingDebtId, openDebtSheetNew, openDebtSheetRecordPayment, openPayDebtSheet } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const data = useDebtTabData()

  const [tab, setTab] = useState<DebtFamily>('borrow')
  const [index, setIndex] = useState(0)
  const [dismissedAssign, setDismissedAssign] = useState<string | null>(null)
  const [chargesTarget, setChargesTarget] = useState<ChargesSheetTarget | null>(null)
  const pickedDefault = useRef(false)

  // Smart default: land on the first non-empty family (once, when data is ready).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time landing tab from store */
    if (pickedDefault.current || !dataReady) return
    pickedDefault.current = true
    setTab(firstNonEmptyFamily(useFinanceStore.getState().debts))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dataReady])

  const changeTab = (f: DebtFamily) => {
    setTab(f)
    setIndex(0)
  }

  const secondaryText = useMemo(() => {
    if (!settings.showSecondaryCurrency || !settings.secondaryCurrency) return null
    return formatCurrency(convertCurrency(data.owed, data.base, settings.secondaryCurrency, exchangeRates), settings.secondaryCurrency)
  }, [settings.showSecondaryCurrency, settings.secondaryCurrency, data.owed, data.base, exchangeRates])

  const guardNew = () => requireAuth(() => openDebtSheetNew(), t.debts.requireAuthNew)
  const guardAddCard = () => requireAuth(() => setActiveModal('addCreditCard'), t.debts.requireAuthNew)
  const guardPay = (id: string) => requireAuth(() => openDebtSheetRecordPayment(id), t.debts.requireAuthPayment)
  const editDebt = (id: string) => {
    setEditingDebtId(id)
    setActiveModal('editDebt')
  }
  const viewCharges = (vm: { id: string; bank: string; last4?: string }) => {
    const pmId = useFinanceStore.getState().debts.find((d) => d.id === vm.id)?.linkedPaymentMethodId
    if (!pmId) return
    setChargesTarget({ pmId, name: vm.bank, last4: vm.last4 })
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const listLen =
    tab === 'borrow' ? data.borrow.length : tab === 'credit_card' ? data.cards.length : data.installments.length

  const renderCard = (i: number) => {
    if (tab === 'borrow') {
      const vm = data.borrow[i]
      return <BorrowHeroCard vm={vm} onEdit={() => editDebt(vm.id)} onPay={() => guardPay(vm.id)} />
    }
    if (tab === 'credit_card') {
      const vm = data.cards[i]
      return (
        <CreditCardHeroCard
          vm={vm}
          onEdit={() => editDebt(vm.id)}
          onPay={() => guardPay(vm.id)}
          onCharges={() => viewCharges(vm)}
        />
      )
    }
    const vm = data.installments[i]
    return <InstallmentHeroCard vm={vm} onEdit={() => editDebt(vm.id)} onPay={() => guardPay(vm.id)} />
  }

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-screen-sm px-4 pt-3 lg:px-6">
        <DebtPortfolioHero
          owed={data.owed}
          base={data.base}
          secondaryText={secondaryText}
          clearedPct={data.clearedPct}
          paidOff={data.paidOff}
          everBorrowed={data.everBorrowed}
          counts={data.counts}
          onAddDebt={guardNew}
        />

        <div className="mt-5">
          <DebtFamilyTabs active={tab} onChange={changeTab} />
        </div>

        {tab === 'installment' && data.assignCandidate && data.assignCandidate.id !== dismissedAssign ? (
          <div className="mt-4">
            <AssignPaymentBanner
              candidate={data.assignCandidate}
              onAssign={() => requireAuth(() => openPayDebtSheet(), t.debts.requireAuthPayment)}
              onDismiss={(id) => setDismissedAssign(id)}
            />
          </div>
        ) : null}

        {listLen === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="🎉"
              title={`No active ${FAMILY_LABEL[tab].toLowerCase()}`}
              description="Nothing to track here right now."
              action={
                <button
                  type="button"
                  onClick={tab === 'credit_card' ? guardAddCard : guardNew}
                  className="rounded-xl bg-[var(--color-brand-red)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)]"
                >
                  {tab === 'credit_card' ? 'Add credit card' : 'Add debt'}
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">
                {FAMILY_LABEL[tab]} <span className="ml-1 text-sm font-medium text-[var(--color-brand-text-muted)]">{listLen} active</span>
              </h2>
              {listLen > 1 ? <span className="text-[13px] text-[var(--color-brand-text-muted)]">swipe →</span> : null}
            </div>
            <RecurringIncomeCarousel count={listLen} activeIndex={Math.min(index, listLen - 1)} onActiveChange={setIndex} renderItem={renderCard} activeDotWidth={18} />
          </div>
        )}

        <DebtPaymentsFeed payments={data.payments} currentFamily={tab} />
      </div>

      <ClearedVaultSheet
        open={activeModal === 'clearedVault'}
        onClose={() => setActiveModal(null)}
        cleared={data.cleared}
        base={data.base}
      />

      <ChargesSheet open={chargesTarget !== null} onClose={() => setChargesTarget(null)} target={chargesTarget} />
    </div>
  )
}
