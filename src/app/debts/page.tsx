'use client'

import { GoalLensList } from '@/components/features/goals/GoalLensList'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, CircleCheck, CreditCard, HandCoins, Layers, Plus, ShieldCheck } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { DebtPortfolioHero } from '@/components/features/debts/redesign/DebtPortfolioHero'
import { DebtFamilyTabs } from '@/components/features/debts/redesign/DebtFamilyTabs'
import { BorrowHeroCard } from '@/components/features/debts/redesign/BorrowHeroCard'
import { CreditCardHeroCard } from '@/components/features/debts/redesign/CreditCardHeroCard'
import { InstallmentHeroCard } from '@/components/features/debts/redesign/InstallmentHeroCard'
import { DebtPaymentsFeed } from '@/components/features/debts/redesign/DebtPaymentsFeed'
import { ClearedVaultSheet } from '@/components/features/debts/redesign/ClearedVaultSheet'
import { ChargesSheet, type ChargesSheetTarget } from '@/components/features/debts/redesign/ChargesSheet'
import { AssignPaymentBanner, type AssignCandidate } from '@/components/features/debts/redesign/AssignPaymentBanner'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { firstNonEmptyFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateDebts, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { StatTile } from '@/components/ui/StatTile'
import { fmtWhole } from '@/components/features/debts/redesign/heroCardShared'

export default function DebtsPage() {
  useHydrateDebts()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates })),
  )
  const { activeModal, setActiveModal, setEditingDebtId, openDebtSheetNew, openDebtSheetRecordPayment } = useSettingsStore()
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

  const addDebt = (family?: DebtFamily) =>
    requireAuth(() => {
      if (family === 'credit_card') setActiveModal('addCreditCard')
      else openDebtSheetNew(family === 'installment' ? 'installment' : family === 'borrow' ? 'personal' : undefined)
    }, t.debts.requireAuthNew)
  const guardPay = (id: string) => requireAuth(() => openDebtSheetRecordPayment(id), t.debts.requireAuthPayment)
  const assignPayment = (c: AssignCandidate) =>
    requireAuth(() => (c.debtId ? openDebtSheetRecordPayment(c.debtId) : openDebtSheetNew('installment')), t.debts.requireAuthPayment)
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
      return <BorrowHeroCard vm={vm} onEdit={() => editDebt(vm.id)} onDelete={() => useFinanceStore.getState().deleteDebt(vm.id)} onPay={() => guardPay(vm.id)} />
    }
    if (tab === 'credit_card') {
      const vm = data.cards[i]
      return (
        <CreditCardHeroCard
          vm={vm}
          onEdit={() => editDebt(vm.id)}
          onDelete={() => useFinanceStore.getState().deleteDebt(vm.id)}
          onPay={() => guardPay(vm.id)}
          onCharges={() => viewCharges(vm)}
        />
      )
    }
    const vm = data.installments[i]
    return <InstallmentHeroCard vm={vm} onEdit={() => editDebt(vm.id)} onDelete={() => useFinanceStore.getState().deleteDebt(vm.id)} onPay={() => guardPay(vm.id)} />
  }

  const noneActive = data.counts.borrow + data.counts.credit_card + data.counts.installment === 0
  const clearedCount = data.cleared.length
  const family = {
    borrow: { title: t.debts.sectionBorrowed, add: t.debts.newDebt, emptyLine: t.debts.emptyFamilyBorrow, emptyCta: t.debts.emptyAddDebt, Icon: HandCoins },
    credit_card: { title: t.debts.sectionCards, add: t.debts.newCard, emptyLine: t.debts.emptyFamilyCard, emptyCta: t.debts.addCardCta, Icon: CreditCard },
    installment: { title: t.debts.sectionInstallments, add: t.debts.newInstallment, emptyLine: t.debts.emptyFamilyInstallment, emptyCta: t.debts.addInstallmentCta, Icon: Layers },
  }[tab]
  const FamilyIcon = family.Icon

  return (
    <div className="pb-24">
      <DebtPortfolioHero
        owed={data.owed}
        base={data.base}
        secondaryText={secondaryText}
        clearedPct={data.clearedPct}
        borrowedTotal={data.borrowedTotal}
      />

      <div className="mx-auto max-w-screen-sm px-4 pt-4 lg:px-6">
        {clearedCount > 0 ? (
          <SelectableCard as="action" surface="card" onClick={() => setActiveModal('clearedVault')}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
              <CircleCheck className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[var(--color-brand-text-primary)]">{t.debts.completedTitle(clearedCount)}</span>
              <span className="block font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">
                {t.debts.completedSub(`${fmtWhole(data.clearedPaid)} ${data.base}`)}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
          </SelectableCard>
        ) : null}

        <div className={clearedCount > 0 ? 'mt-4' : ''}>
          <GoalLensList categories={['debt_freedom']} />
        </div>

        {noneActive ? (
          <EmptyState
            className="mt-2"
            icon={
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                <ShieldCheck className="h-7 w-7" aria-hidden />
              </span>
            }
            title={clearedCount > 0 ? t.debts.emptyClearedTitle : t.debts.emptyNoneTitle}
            description={clearedCount > 0 ? t.debts.emptyClearedBody : t.debts.emptyNoneBody}
            action={
              <div className="flex w-full max-w-sm flex-col items-stretch gap-4">
                {clearedCount > 0 ? (
                  <div className="grid grid-cols-2 gap-3 text-start">
                    <StatTile label={t.debts.statDebtsCleared} value={clearedCount} tone="positive" />
                    <StatTile label={t.debts.statTotalPaidOff} value={fmtWhole(data.paidOff)} unit={data.base} tone="positive" />
                  </div>
                ) : null}
                <Button size="cta" onClick={() => addDebt()}>
                  {t.debts.emptyAddDebt}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="mt-5">
              <DebtFamilyTabs active={tab} onChange={changeTab} counts={data.counts} />
            </div>

            {tab === 'installment' && data.assignCandidate && data.assignCandidate.id !== dismissedAssign ? (
              <div className="mt-4">
                <AssignPaymentBanner candidate={data.assignCandidate} onAssign={assignPayment} onDismiss={(id) => setDismissedAssign(id)} />
              </div>
            ) : null}

            {listLen === 0 ? (
              <EmptyState
                icon={
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]">
                    <FamilyIcon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
                  </span>
                }
                title={family.emptyLine}
                action={
                  <Button size="cta" variant="secondary" onClick={() => addDebt(tab)}>
                    {family.emptyCta}
                  </Button>
                }
              />
            ) : (
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">
                    {family.title} <span className="ms-1 font-mono-numbers text-sm font-medium text-[var(--color-brand-text-muted)]">{listLen}</span>
                  </h2>
                  <Button variant="secondary" size="touch" className="ms-auto" onClick={() => addDebt(tab)}>
                    <Plus aria-hidden />
                    {family.add}
                  </Button>
                </div>
                <RecurringIncomeCarousel count={listLen} activeIndex={Math.min(index, listLen - 1)} onActiveChange={setIndex} renderItem={renderCard} activeDotWidth={18} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Full-bleed ledger — identical to the Expenses/Income lists (no side inset). */}
      <div className="mx-auto max-w-screen-sm">
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
