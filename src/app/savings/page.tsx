'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PieChart, Plus, Minus } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  totalSavingsAccountsBalanceInBase,
  totalSavingsHoldingsInBase,
} from '@/lib/utils/calculations'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useNetWorth } from '@/hooks/useNetWorth'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { SavingsAccountCard } from '@/components/features/savings/SavingsAccountCard'
import { AddToSavingsSheet } from '@/components/features/savings/AddToSavingsSheet'
import { WithdrawFromSavingsSheet } from '@/components/features/savings/WithdrawFromSavingsSheet'
import { UpdateBalanceSheet } from '@/components/features/savings/UpdateBalanceSheet'
import { SavingsTransactionHistory } from '@/components/features/savings/SavingsTransactionHistory'
import { AddSavingsAccountSheet } from '@/components/modals/AddSavingsAccountSheet'
import { EditSavingsAccountSheet } from '@/components/modals/EditSavingsAccountSheet'
import type { SavingsAccount } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { convertCurrency } from '@/lib/utils/currency'
import { useHydrateSavings, useHydrateGoals } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'

const headerWithdrawClass =
  'inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors'
const headerAddClass =
  'inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-green-hover)] transition-colors'

/**
 * Savings buckets, transfer sheets, and ledger history (not expenses).
 */
export default function SavingsPage() {
  useHydrateSavings()
  useHydrateGoals()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const t = useT()
  const requireAuth = useRequireAuthAction()
  const nw = useNetWorth()
  const {
    savingsAccounts,
    savingsTransactions,
    savingsHoldings,
    settings,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
    depositToSavings,
    withdrawFromSavings,
    correctSavingsBalance,
    deleteSavingsAccount,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      savingsTransactions: s.savingsTransactions,
      savingsHoldings: s.savingsHoldings,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
      depositToSavings: s.depositToSavings,
      withdrawFromSavings: s.withdrawFromSavings,
      correctSavingsBalance: s.correctSavingsBalance,
      deleteSavingsAccount: s.deleteSavingsAccount,
    }))
  )

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [updateAcc, setUpdateAcc] = useState<SavingsAccount | null>(null)
  const [editAcc, setEditAcc] = useState<SavingsAccount | null>(null)

  const totalBase = useMemo(() => {
    const goldOk = goldPriceAvailable !== false
    const a = totalSavingsAccountsBalanceInBase(
      savingsAccounts,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram,
      goldOk
    )
    const h = totalSavingsHoldingsInBase(savingsHoldings, settings.baseCurrency, exchangeRates)
    return a + h
  }, [
    savingsAccounts,
    savingsHoldings,
    settings.baseCurrency,
    exchangeRates,
    goldPricePerGram,
    goldPriceAvailable,
  ])

  const totalSavedDisplay = nw.totalSavings + nw.totalInvestments

  const nwSecondary =
    settings.showSecondaryCurrency && settings.secondaryCurrency
      ? convertCurrency(nw.netWorth, settings.baseCurrency, settings.secondaryCurrency, exchangeRates)
      : null

  const guard = useCallback(
    (fn: () => void) => requireAuth(fn, t.savings.requireAuth),
    [requireAuth, t.savings.requireAuth]
  )

  const openAdd = (id?: string | null) => {
    guard(() => {
      setPrefillId(id ?? null)
      setAddOpen(true)
    })
  }

  const openWithdraw = (id?: string | null) => {
    guard(() => {
      setPrefillId(id ?? null)
      setWithdrawOpen(true)
    })
  }

  const confirmDelete = (acc: SavingsAccount) => {
    if (globalThis.confirm?.(t.savings.confirmDeleteSavings)) {
      deleteSavingsAccount(acc.id)
    }
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="pb-24">
      <PageHeader>
        <PageHeaderContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-brand-text-muted)]">
              <span>
                <span className="text-[var(--color-brand-text-secondary)]">{t.savings.netWorthShort}: </span>
                <span
                  className={`font-mono-numbers font-semibold ${
                    nw.netWorth >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red-text)]'
                  }`}
                >
                  {formatCurrency(nw.netWorth, settings.baseCurrency)}
                </span>
                {nwSecondary != null && settings.secondaryCurrency ? (
                  <span className="font-mono-numbers text-[var(--color-brand-text-muted)] ms-1">
                    ({formatCurrency(nwSecondary, settings.secondaryCurrency)})
                  </span>
                ) : null}
              </span>
              <span>
                <span className="text-[var(--color-brand-text-secondary)]">{t.savings.totalSavedShort}: </span>
                <span className="font-mono-numbers font-semibold text-[var(--color-brand-green)]">
                  {formatCurrency(totalSavedDisplay, settings.baseCurrency)}
                </span>
              </span>
              <span className="text-[10px] opacity-80">
                {t.savings.totalLine(settings.baseCurrency)}
                <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                  {formatCurrency(totalBase, settings.baseCurrency)}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => guard(() => setWithdrawOpen(true))} className={headerWithdrawClass}>
              <Minus className="h-4 w-4" />
              {t.savings.withdraw}
            </button>
            <button type="button" onClick={() => guard(() => setAddOpen(true))} className={headerAddClass}>
              <Plus className="h-4 w-4" />
              {t.savings.addToSavings}
            </button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-4 lg:px-6 max-w-3xl mx-auto space-y-4">
        <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-elevated)]">
              <PieChart className="h-4 w-4 text-[var(--color-brand-red)]" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
              {t.savings.breakdownTitle}
            </h2>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-[var(--color-brand-text-muted)]">
              {t.savings.breakdownRowTotal}
            </p>
            <p
              className={`text-xl sm:text-2xl font-mono-numbers font-bold ${
                nw.netWorth >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red-text)]'
              }`}
            >
              {formatCurrency(nw.netWorth, settings.baseCurrency)}
            </p>
          </div>

          <div className="h-px bg-[var(--color-brand-border)]" />

          <ul className="grid gap-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--color-brand-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand-green)]" aria-hidden />
                {t.savings.breakdownRowSavings}
              </span>
              <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                {formatCurrency(nw.totalSavings, settings.baseCurrency)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--color-brand-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand-green)]/60" aria-hidden />
                {t.savings.breakdownRowInvestments}
              </span>
              <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                {formatCurrency(nw.totalInvestments, settings.baseCurrency)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--color-brand-text-secondary)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    nw.monthlyFlow >= 0 ? 'bg-[var(--color-brand-green)]/80' : 'bg-[var(--color-brand-red)]/80'
                  }`}
                  aria-hidden
                />
                {t.savings.breakdownRowMonth}
              </span>
              <span
                className={`font-mono-numbers ${
                  nw.monthlyFlow >= 0 ? 'text-[var(--color-brand-text-primary)]' : 'text-[var(--color-brand-red-text)]'
                }`}
              >
                {nw.monthlyFlow < 0 ? '− ' : ''}
                {formatCurrency(Math.abs(nw.monthlyFlow), settings.baseCurrency)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[var(--color-brand-text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-brand-red)]" aria-hidden />
                {t.savings.breakdownRowDebt}
              </span>
              <span className="font-mono-numbers text-[var(--color-brand-red-text)]">
                − {formatCurrency(nw.totalDebt, settings.baseCurrency)}
              </span>
            </li>
          </ul>
        </section>

        {savingsAccounts.length === 0 ? (
          <div className="glass-card rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.savings.emptyAccounts}</p>
            <button
              type="button"
              onClick={() => guard(() => setNewAccountOpen(true))}
              className="rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t.savings.emptyAccountsCta}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {savingsAccounts.map((acc) => (
              <SavingsAccountCard
                key={acc.id}
                account={acc}
                onAdd={() => openAdd(acc.id)}
                onWithdraw={() => openWithdraw(acc.id)}
                onUpdateBalance={() => {
                  guard(() => {
                    setUpdateAcc(acc)
                    setUpdateOpen(true)
                  })
                }}
                onEdit={() => {
                  guard(() => {
                    setEditAcc(acc)
                    setEditOpen(true)
                  })
                }}
                onDelete={() => confirmDelete(acc)}
              />
            ))}
          </div>
        )}

        <SavingsTransactionHistory transactions={savingsTransactions} accounts={savingsAccounts} />
      </div>

      {addOpen && (
        <AddToSavingsSheet
          open
          onClose={() => {
            setAddOpen(false)
            setPrefillId(null)
          }}
          accounts={savingsAccounts}
          defaultAccountId={prefillId}
          onDeposit={(id, amt, cur, notes) => depositToSavings(id, amt, cur, notes)}
        />
      )}
      {withdrawOpen && (
        <WithdrawFromSavingsSheet
          open
          onClose={() => {
            setWithdrawOpen(false)
            setPrefillId(null)
          }}
          accounts={savingsAccounts}
          defaultAccountId={prefillId}
          onWithdraw={(id, amt, cur, notes) => withdrawFromSavings(id, amt, cur, notes)}
        />
      )}
      {updateOpen && updateAcc && (
        <UpdateBalanceSheet
          key={updateAcc.id}
          open
          onClose={() => {
            setUpdateOpen(false)
            setUpdateAcc(null)
          }}
          account={updateAcc}
          onCorrect={(nb, notes) => {
            correctSavingsBalance(updateAcc.id, nb, notes)
          }}
        />
      )}
      {newAccountOpen && <AddSavingsAccountSheet open onClose={() => setNewAccountOpen(false)} />}
      {editOpen && (
        <EditSavingsAccountSheet
          open={editOpen}
          account={editAcc}
          onClose={() => {
            setEditOpen(false)
            setEditAcc(null)
          }}
        />
      )}
    </div>
  )
}
