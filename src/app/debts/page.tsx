'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebtCard } from '@/components/debts/DebtCard'
import { DebtTable } from '@/components/debts/DebtTable'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'

export default function DebtsPage() {
  const { debts, debtPayments } = useFinanceStore(
    useShallow((s) => ({ debts: s.debts, debtPayments: s.debtPayments }))
  )
  const { openDebtSheetNew, openDebtSheetRecordPayment, setActiveModal, setEditingDebtId } = useSettingsStore()

  const handleEditDebt = (debtId: string) => {
    setEditingDebtId(debtId)
    setActiveModal('editDebt')
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Debts</h1>
          <button
            type="button"
            onClick={() => openDebtSheetNew()}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
          >
            + Add Debt
          </button>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 space-y-8 max-w-5xl mx-auto">
        {debts.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No debts yet"
            description="Track loans or informal debts, record payments, and see them alongside your expenses."
            action={
              <button
                type="button"
                onClick={() => openDebtSheetNew()}
                className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                + Add debt
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {debts.map((debt) => {
                const payments = debtPayments.filter((p) => p.debtId === debt.id)
                return (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    payments={payments}
                    onRecordPayment={() => openDebtSheetRecordPayment(debt.id)}
                    onEdit={() => handleEditDebt(debt.id)}
                  />
                )
              })}
            </div>

            {debts.map((debt) => {
              const payments = debtPayments.filter((p) => p.debtId === debt.id)
              return (
                <div key={debt.id} className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
                    {debt.name} — Payment History
                  </h3>
                  <DebtTable debt={debt} payments={payments} />
                </div>
              )
            })}
          </>
        )}
      </div>

      <QuickAddFAB />
    </div>
  )
}
