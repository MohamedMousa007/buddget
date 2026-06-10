'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { IncomeSourceRow } from '@/components/features/income/IncomeSourceRow'
import { useHydrateIncome, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'

export default function IncomePage() {
  useHydrateIncome()
  useHydrateDebts()
  useHydrateSavings()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { incomeSources, deleteIncomeSource, savingsAccounts, debts, paymentMethods } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      deleteIncomeSource: s.deleteIncomeSource,
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      paymentMethods: s.paymentMethods,
    }))
  )
  const { setActiveModal, setEditingIncomeId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const confirm = useConfirm()
  const t = useT()

  const openAddIncome = () =>
    requireAuth(
      () => setActiveModal('addIncome'),
      t.income.requireAuth
    )

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[var(--color-brand-red)]" />
            {t.income.pageTitle}
          </h1>
          <button
            type="button"
            onClick={openAddIncome}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
          >
            {t.income.addSource}
          </button>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-3">
        <p className="text-xs text-[var(--color-brand-text-muted)]">
          {t.income.helperText}
        </p>
        {incomeSources.length === 0 ? (
          <div className="glass-card rounded-2xl p-2">
            <EmptyState
              icon={t.income.emptyIcon}
              title={t.income.emptyTitle}
              description={t.income.emptyDesc}
              action={
                <button
                  type="button"
                  onClick={openAddIncome}
                  className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
                >
                  {t.income.emptyButton}
                </button>
              }
            />
          </div>
        ) : (
          incomeSources.map((source) => (
            <IncomeSourceRow
              key={source.id}
              source={source}
              savingsAccounts={savingsAccounts}
              debts={debts}
              paymentMethods={paymentMethods}
              inc={t.income}
              common={t.common}
              onEdit={() => {
                setEditingIncomeId(source.id)
                setActiveModal('editIncome')
              }}
              onDelete={async () => {
                if (await confirm({ title: t.income.confirmDelete, destructive: true })) {
                  deleteIncomeSource(source.id)
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
