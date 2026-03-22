'use client'

import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebtCard } from '@/components/debts/DebtCard'
import { DebtTable } from '@/components/debts/DebtTable'
import { QuickAddFAB } from '@/components/modals/QuickAddFAB'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/lib/hooks/useRequireAuthAction'
import { formatCurrency } from '@/lib/utils/formatters'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'

export default function DebtsPage() {
  const { debts, debtPayments, recurringDebtPayments, updateRecurringDebtPayment, deleteRecurringDebtPayment } =
    useFinanceStore(
      useShallow((s) => ({
        debts: s.debts,
        debtPayments: s.debtPayments,
        recurringDebtPayments: s.recurringDebtPayments,
        updateRecurringDebtPayment: s.updateRecurringDebtPayment,
        deleteRecurringDebtPayment: s.deleteRecurringDebtPayment,
      }))
    )
  const { openDebtSheetNew, openDebtSheetRecordPayment, setActiveModal, setEditingDebtId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()

  const guardedNewDebt = () =>
    requireAuth(
      () => openDebtSheetNew(),
      'Sign in or create an account to add debts or record payments.'
    )
  const guardedRecordPayment = (debtId: string) =>
    requireAuth(
      () => openDebtSheetRecordPayment(debtId),
      'Sign in or create an account to record debt payments.'
    )

  const openRecurringDebtSheet = () =>
    requireAuth(
      () => setActiveModal('addRecurringDebtPayment'),
      'Sign in or create an account to add recurring debt payments.'
    )

  const handleEditDebt = (debtId: string) => {
    setEditingDebtId(debtId)
    setActiveModal('editDebt')
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-white">Debts</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openRecurringDebtSheet()}
              className="px-4 py-2 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] text-sm font-medium transition-colors"
            >
              + Recurring payment
            </button>
            <button
              type="button"
              onClick={() => guardedNewDebt()}
              className="px-4 py-2 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
            >
              + Add Debt
            </button>
          </div>
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
                onClick={() => guardedNewDebt()}
                className="px-6 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                + Add debt
              </button>
            }
          />
        ) : (
          <>
            {recurringDebtPayments.length > 0 ? (
              <section className="glass-card rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
                  Recurring payments
                </h2>
                <p className="text-xs text-[var(--color-brand-text-muted)]">
                  Due payments post automatically when you open the app (next due date today or earlier). You can pause
                  or delete a schedule anytime.
                </p>
                <ul className="space-y-2">
                  {recurringDebtPayments.map((r) => {
                    const debt = debts.find((d) => d.id === r.debtId)
                    const freqLabel =
                      r.frequency === 'monthly' ? 'Monthly' : r.frequency === 'biweekly' ? 'Bi-weekly' : 'Weekly'
                    return (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-brand-elevated)]/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-white">{debt?.name ?? 'Unknown debt'}</p>
                          <p className="text-xs text-[var(--color-brand-text-muted)]">
                            {formatCurrency(r.amount, r.currency)} · {freqLabel} · next {r.nextDueDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--color-brand-text-muted)] uppercase">Active</span>
                          <Switch
                            checked={r.isActive}
                            onCheckedChange={(on) => updateRecurringDebtPayment(r.id, { isActive: on })}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Remove this recurring payment schedule?')) {
                                deleteRecurringDebtPayment(r.id)
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-900/30"
                            aria-label="Delete schedule"
                          >
                            <Trash2 className="w-4 h-4 text-[var(--color-brand-red)]" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {debts.map((debt) => {
                const payments = debtPayments.filter((p) => p.debtId === debt.id)
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
