'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebtCard } from '@/components/debts/DebtCard'
import { AllDebtsPaymentHistory } from '@/components/features/debts/AllDebtsPaymentHistory'
import { DebtHistoryTable } from '@/components/features/debts/DebtHistoryTable'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { formatCurrency } from '@/lib/utils/formatters'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'

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

  const openRecurringDebtSheet = () =>
    requireAuth(
      () => setActiveModal('addRecurringDebtPayment'),
      t.debts.requireAuthRecurring
    )

  const handleEditDebt = (debtId: string) => {
    setEditingDebtId(debtId)
    setActiveModal('editDebt')
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <PageHeaderContent className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-white">{t.debts.pageTitle}</h1>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => guardedPayDebt()}
              className="px-4 py-2 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] text-sm font-medium transition-colors"
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
            {recurringDebtPayments.length > 0 ? (
              <section className="glass-card rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
                  {t.debts.sectionRecurring}
                </h2>
                <p className="text-xs text-[var(--color-brand-text-muted)]">{t.debts.recurringHelp}</p>
                <ul className="space-y-2">
                  {recurringDebtPayments.map((r) => {
                    const debt = debts.find((d) => d.id === r.debtId)
                    const freqLabel =
                      r.frequency === 'monthly'
                        ? t.debts.freqMonthly
                        : r.frequency === 'biweekly'
                          ? t.debts.freqBiweekly
                          : r.frequency === 'weekly'
                            ? t.debts.freqWeekly
                            : r.frequency === 'quarterly'
                              ? t.addDebt.freqQuarterly
                              : t.addDebt.freqAnnually
                    return (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-brand-elevated)]/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-white">{debt?.name ?? t.debts.unknownDebt}</p>
                          <p className="text-xs text-[var(--color-brand-text-muted)]">
                            {formatCurrency(r.amount, r.currency)} · {freqLabel} · {t.debts.paymentNext}
                            {r.nextDueDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--color-brand-text-muted)] uppercase">
                            {t.debts.activeLabel}
                          </span>
                          <Switch
                            checked={r.isActive}
                            onCheckedChange={(on) => updateRecurringDebtPayment(r.id, { isActive: on })}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t.debts.confirmDeleteSchedule)) {
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
                <button
                  type="button"
                  onClick={() => openRecurringDebtSheet()}
                  className="text-sm text-[var(--color-brand-gold)] hover:underline"
                >
                  {t.debts.buttonRecurring}
                </button>
              </section>
            ) : null}

            {activeDebts.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center space-y-2">
                <p className="text-lg font-semibold text-white">{t.debts.emptyActiveTitle}</p>
                <p className="text-sm text-[var(--color-brand-text-muted)]">{t.debts.emptyActiveDesc}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeDebts.map((debt) => {
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
            )}

            {debts.length > 0 && recurringDebtPayments.length === 0 ? (
              <p className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => openRecurringDebtSheet()}
                  className="text-[var(--color-brand-gold)] hover:underline"
                >
                  {t.debts.buttonRecurring}
                </button>
              </p>
            ) : null}

            <AllDebtsPaymentHistory debts={debts} debtPayments={debtPayments} />
            <DebtHistoryTable debts={debts} debtPayments={debtPayments} />
          </>
        )}
      </div>
    </div>
  )
}
