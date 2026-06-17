'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebtCard } from '@/components/debts/DebtCard'
import { CreditCardDebtCard } from '@/components/features/debts/CreditCardDebtCard'
import { AllDebtsPaymentHistory } from '@/components/features/debts/AllDebtsPaymentHistory'
import { DebtHistoryTable } from '@/components/features/debts/DebtHistoryTable'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { Landmark, Plus, Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useHydrateDebts, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { formatCurrency } from '@/lib/utils/formatters'

export default function DebtsPage() {
  useHydrateDebts()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const stats = useMonthlyStats()
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const { debts, debtPayments } = useFinanceStore(
    useShallow((s) => ({
      debts: s.debts,
      debtPayments: s.debtPayments,
    }))
  )
  const { openDebtSheetNew, openPayDebtSheet, openDebtSheetRecordPayment, setActiveModal, setEditingDebtId } =
    useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()

  const activeDebts = useMemo(
    () => debts.filter((d) => d.status !== 'cleared'),
    [debts]
  )

  const guardedNewDebt = () =>
    requireAuth(
      () => openDebtSheetNew(),
      t.debts.requireAuthNew
    )
  const guardedPayDebt = () =>
    requireAuth(
      () => openPayDebtSheet(),
      t.debts.requireAuthPayment
    )
  const guardedRecordPayment = (debtId: string) =>
    requireAuth(
      () => openDebtSheetRecordPayment(debtId),
      t.debts.requireAuthPayment
    )

  const handleEditDebt = (debtId: string) => {
    setEditingDebtId(debtId)
    setActiveModal('editDebt')
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div>
      <div className="px-4 pt-[14px] pb-4 lg:px-6 space-y-5 max-w-6xl mx-auto">
        {/* Overview card: total still owed + active-debts pill + actions */}
        <div className="rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[18px] dark:bg-[linear-gradient(150deg,#1d1416,#121017)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
            {t.debts.totalStillOwed}
          </p>
          <p className="font-mono-numbers mt-[7px] text-[30px] font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-text-primary)]">
            {formatCurrency(stats.debtRemainingTotal, baseCurrency)}
          </p>
          <span className="mt-[10px] inline-flex items-center gap-[6px] rounded-full bg-[rgba(255,92,92,0.12)] px-[11px] py-1 text-[11.5px] font-bold text-[#FF5C5C]">
            <Landmark className="h-[13px] w-[13px]" strokeWidth={2.2} />
            {t.debts.activeDebtsCount(activeDebts.length)}
          </span>
          <div className="mt-[14px] flex gap-[9px]">
            <button
              type="button"
              onClick={() => guardedPayDebt()}
              className="flex h-[42px] flex-1 items-center justify-center gap-[7px] rounded-[13px] bg-[var(--color-brand-green)] text-[13.5px] font-bold text-white hover:bg-[var(--color-brand-green-hover)]"
            >
              <Check className="h-4 w-4" strokeWidth={2.2} />
              {t.debts.buttonPayDebt}
            </button>
            <button
              type="button"
              onClick={() => guardedNewDebt()}
              className="flex h-[42px] flex-1 items-center justify-center gap-[7px] rounded-[13px] bg-[var(--color-brand-red)] text-[13.5px] font-bold text-white hover:bg-[var(--color-brand-red-hover)]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              {t.debts.buttonAddDebt.replace(/^\+\s*/, '')}
            </button>
          </div>
        </div>

        {debts.length === 0 ? (
          <EmptyState
            icon={t.debts.emptyIcon}
            title={t.debts.emptyTitle}
            description={t.debts.emptyDesc}
            action={
              <button
                type="button"
                onClick={() => guardedNewDebt()}
                className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                {t.debts.emptyButton}
              </button>
            }
          />
        ) : (
          <>
            {activeDebts.length === 0 ? (
              <div className="glass-card rounded-2xl p-5 text-center space-y-2">
                <p className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.debts.emptyActiveTitle}</p>
                <p className="text-sm text-[var(--color-brand-text-muted)]">{t.debts.emptyActiveDesc}</p>
              </div>
            ) : (
              <div className={`grid gap-4 ${activeDebts.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
                {activeDebts.map((debt) => {
                  const payments = debtPayments.filter((p) => p.debtId === debt.id)
                  if (debt.debtType === 'credit_card') {
                    return (
                      <div key={debt.id}>
                        <CreditCardDebtCard
                          debt={debt}
                          payments={payments}
                          onRecordPayment={() => guardedRecordPayment(debt.id)}
                          onEdit={() => handleEditDebt(debt.id)}
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={debt.id}>
                      <DebtCard
                        debt={debt}
                        payments={payments}
                        onRecordPayment={() => guardedRecordPayment(debt.id)}
                        onEdit={() => handleEditDebt(debt.id)}
                      />
                    </div>
                  )
                })}
              </div>
            )}

            <AllDebtsPaymentHistory debts={debts} debtPayments={debtPayments} />
            <DebtHistoryTable debts={debts} debtPayments={debtPayments} />
          </>
        )}
      </div>
    </div>
  )
}
