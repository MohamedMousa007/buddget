'use client'

import { countedDebts } from '@/lib/spending/exclusion'
import { PageGrid } from '@/components/layout/PageGrid'
import { PageHero } from '@/components/layout/PageHero'
import { DebtGoalPrompt } from '@/components/features/goals/DebtGoalPrompt'
import { GoalLensList } from '@/components/features/goals/GoalLensList'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Award, ChevronRight, CreditCard, Pencil, ReceiptText, ShieldCheck, Smartphone, Trash2, Undo2, User, Wallet } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { DebtPortfolioHero } from '@/components/features/debts/redesign/DebtPortfolioHero'
import { DebtFamilyTabs } from '@/components/features/debts/redesign/DebtFamilyTabs'
import { DebtsActiveList } from '@/components/features/debts/redesign/DebtsActiveList'
import { DebtPaymentsFeed } from '@/components/features/debts/redesign/DebtPaymentsFeed'
import { ClearedVaultSheet } from '@/components/features/debts/redesign/ClearedVaultSheet'
import { ChargesSheet, type ChargesSheetTarget } from '@/components/features/debts/redesign/ChargesSheet'
import { AssignPaymentBanner, type AssignCandidate } from '@/components/features/debts/redesign/AssignPaymentBanner'
import { useDebtTabData } from '@/hooks/useDebtTabData'
import { firstNonEmptyFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency, formatWhole } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

type AddKind = 'borrow' | 'installment' | 'credit_card'
type RowAction = 'pay' | 'edit' | 'charges' | 'delete'

export default function DebtsPage() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates })),
  )
  const { activeModal, setActiveModal, setEditingDebtId, openDebtSheetNew, openDebtSheetRecordPayment } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const c = useDebtsSubsLtCopy().debts
  const confirm = useConfirm()
  const data = useDebtTabData()

  const [tab, setTab] = useState<DebtFamily>('borrow')
  const [addOpen, setAddOpen] = useState(false)
  const [rowId, setRowId] = useState<string | null>(null)
  const [dismissedAssign, setDismissedAssign] = useState<string | null>(null)
  const [chargesTarget, setChargesTarget] = useState<ChargesSheetTarget | null>(null)
  const pickedDefault = useRef(false)

  // Smart default: land on the first non-empty family (once, when data is ready).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time landing tab from store */
    if (pickedDefault.current || !dataReady) return
    pickedDefault.current = true
    { const st = useFinanceStore.getState(); setTab(firstNonEmptyFamily(countedDebts(st.debts, st.paymentMethods))) }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dataReady])

  const secondaryText = useMemo(() => {
    if (!settings.showSecondaryCurrency || !settings.secondaryCurrency) return null
    return formatCurrency(convertCurrency(data.owed, data.base, settings.secondaryCurrency, exchangeRates), settings.secondaryCurrency)
  }, [settings.showSecondaryCurrency, settings.secondaryCurrency, data.owed, data.base, exchangeRates])

  const addDebt = (kind: AddKind) =>
    requireAuth(() => {
      if (kind === 'credit_card') setActiveModal('addCreditCard')
      else openDebtSheetNew(kind === 'installment' ? 'installment' : 'personal')
    }, t.debts.requireAuthNew)
  const assignPayment = (a: AssignCandidate) =>
    requireAuth(() => (a.debtId ? openDebtSheetRecordPayment(a.debtId) : openDebtSheetNew('installment')), t.debts.requireAuthPayment)

  const rowDebt = rowId ? useFinanceStore.getState().debts.find((d) => d.id === rowId) : undefined
  const runRow = (action: RowAction) => {
    const debt = rowDebt
    if (!debt) return
    if (action === 'pay') requireAuth(() => openDebtSheetRecordPayment(debt.id), t.debts.requireAuthPayment)
    else if (action === 'edit') { setEditingDebtId(debt.id); setActiveModal('editDebt') }
    else if (action === 'charges') {
      const vm = data.cards.find((x) => x.id === debt.id)
      if (debt.linkedPaymentMethodId) setChargesTarget({ pmId: debt.linkedPaymentMethodId, name: vm?.bank ?? debt.name, last4: vm?.last4 })
    } else {
      void confirm({ title: c.deleteTitle(debt.name || debt.person), body: c.deleteBody, confirmLabel: t.common.delete, destructive: true })
        .then((ok) => { if (ok) useFinanceStore.getState().deleteDebt(debt.id) })
    }
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  const noneActive = data.counts.borrow + data.counts.credit_card + data.counts.installment === 0
  const clearedCount = data.cleared.length
  const clearedTotal = data.cleared.reduce((s, x) => s + x.original, 0)

  return (
    <div>
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

      <PageGrid
          stack
          primary={
            <div className="px-4 pt-4 lg:px-0 lg:pt-0">
                <DebtGoalPrompt />
                <GoalLensList categories={['debt_freedom']} />

                {noneActive && clearedCount === 0 ? (
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
                    <div className="mt-5 lg:mt-0">
                      <DebtFamilyTabs active={tab} onChange={setTab} />
                    </div>

                    {tab === 'installment' && data.assignCandidate && data.assignCandidate.id !== dismissedAssign ? (
                      <div className="mt-4">
                        <AssignPaymentBanner candidate={data.assignCandidate} onAssign={assignPayment} onDismiss={(id) => setDismissedAssign(id)} />
                      </div>
                    ) : null}

                    <div className="mt-6">
                      <DebtsActiveList
                        family={tab}
                        borrow={data.borrow}
                        installments={data.installments}
                        cards={data.cards}
                        onAdd={() => setAddOpen(true)}
                        onOpen={setRowId}
                      />
                    </div>
                  </>
                )}
            </div>
          }
          secondary={
            <div className="px-4 lg:px-0">
              <DebtPaymentsFeed payments={data.payments} />
              {clearedCount > 0 ? (
                <Button
                  variant="outline"
                  size="touch"
                  onClick={() => setActiveModal('clearedVault')}
                  className="mb-6 mt-3 w-full justify-start rounded-[14px] border-dashed text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]"
                >
                  <Award aria-hidden />
                  <span className="flex-1 text-start">{c.cleared(clearedCount, formatWhole(clearedTotal))}</span>
                  <ChevronRight aria-hidden className="rtl:rotate-180" />
                </Button>
              ) : null}
            </div>
          }
        />

      <OptionSheet<AddKind>
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={c.addTitle}
        subtitle={c.addSub}
        value={null}
        onChange={addDebt}
        options={[
          { value: 'borrow', title: c.addBorrow.title, subtitle: c.addBorrow.sub, icon: <User />, tone: 'var(--color-brand-amber)' },
          { value: 'installment', title: c.addInstallment.title, subtitle: c.addInstallment.sub, icon: <Smartphone />, tone: 'var(--color-brand-primary)' },
          { value: 'credit_card', title: c.addCard.title, subtitle: c.addCard.sub, icon: <CreditCard />, tone: 'var(--color-brand-green)' },
        ]}
      />

      <OptionSheet<RowAction>
        open={rowDebt !== undefined}
        onClose={() => setRowId(null)}
        title={rowDebt ? rowDebt.name || rowDebt.person : ''}
        value={null}
        onChange={runRow}
        options={[
          rowDebt && isOwedToUser(rowDebt)
            ? { value: 'pay' as const, title: c.rowActions.receive, icon: <Undo2 />, tone: 'var(--color-brand-green)' }
            : { value: 'pay' as const, title: c.rowActions.pay, icon: <Wallet /> },
          { value: 'edit' as const, title: c.rowActions.edit, icon: <Pencil /> },
          ...(rowDebt?.debtType === 'credit_card' && rowDebt.linkedPaymentMethodId ? [{ value: 'charges' as const, title: c.rowActions.charges, icon: <ReceiptText /> }] : []),
          { value: 'delete' as const, title: c.rowActions.delete, icon: <Trash2 />, tone: 'var(--color-brand-red)' },
        ]}
      />

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
