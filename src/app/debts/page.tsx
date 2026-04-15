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
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { Landmark } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useHydrateDebts, useHydrateGoals } from '@/hooks/remote'

export default function DebtsPage() {
  useHydrateDebts()
  useHydrateGoals()
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

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <Landmark className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.debts.pageTitle}
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => guardedPayDebt()}
              className="px-4 py-2 rounded-lg bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/80 text-white text-sm font-medium transition-colors"
            >
              {t.debts.buttonPayDebt}
            </button>
            <button
              type="button"
              onClick={() => guardedNewDebt()}
              className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
            >
              {t.debts.buttonAddDebt}
            </button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-8 max-w-5xl mx-auto">
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
              <div className="glass-card rounded-2xl p-8 text-center space-y-2">
                <p className="text-lg font-semibold text-[var(--color-brand-text-primary)]">{t.debts.emptyActiveTitle}</p>
                <p className="text-sm text-[var(--color-brand-text-muted)]">{t.debts.emptyActiveDesc}</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${activeDebts.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {activeDebts.map((debt) => {
                  const payments = debtPayments.filter((p) => p.debtId === debt.id)
                  if (debt.debtType === 'credit_card') {
                    return (
                      <CreditCardDebtCard
                        key={debt.id}
                        debt={debt}
                        payments={payments}
                        onRecordPayment={() => guardedRecordPayment(debt.id)}
                        onEdit={() => handleEditDebt(debt.id)}
                      />
                    )
                  }
                  return (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      payments={payments}
                      onRecordPayment={() => guardedRecordPayment(debt.id)}
                      onEdit={() => handleEditDebt(debt.id)}
                    />
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
