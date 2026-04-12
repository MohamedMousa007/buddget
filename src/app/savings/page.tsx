'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { HandCoins, Plus, Minus } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  totalSavingsAccountsBalanceInBase,
  totalSavingsHoldingsInBase,
} from '@/lib/utils/calculations'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { PageHeader, PageHeaderContent } from '@/components/layout/PageHeader'
import { SavingsAccountCard } from '@/components/features/savings/SavingsAccountCard'
import { AddToSavingsSheet } from '@/components/features/savings/AddToSavingsSheet'
import { WithdrawFromSavingsSheet } from '@/components/features/savings/WithdrawFromSavingsSheet'
import { UpdateBalanceSheet } from '@/components/features/savings/UpdateBalanceSheet'
import { SavingsTransactionHistory } from '@/components/features/savings/SavingsTransactionHistory'
import { AddSavingsAccountSheet } from '@/components/modals/AddSavingsAccountSheet'
import type { SavingsAccount } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

/**
 * Savings accounts, transfer sheets, and ledger history (not expenses).
 */
export default function SavingsPage() {
  const t = useT()
  const requireAuth = useRequireAuthAction()
  const {
    savingsAccounts,
    savingsTransactions,
    savingsHoldings,
    settings,
    exchangeRates,
    depositToSavings,
    withdrawFromSavings,
    correctSavingsBalance,
    updateSavingsAccount,
    deleteSavingsAccount,
  } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      savingsTransactions: s.savingsTransactions,
      savingsHoldings: s.savingsHoldings,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      depositToSavings: s.depositToSavings,
      withdrawFromSavings: s.withdrawFromSavings,
      correctSavingsBalance: s.correctSavingsBalance,
      updateSavingsAccount: s.updateSavingsAccount,
      deleteSavingsAccount: s.deleteSavingsAccount,
    }))
  )

  const [addOpen, setAddOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [prefillId, setPrefillId] = useState<string | null>(null)
  const [updateAcc, setUpdateAcc] = useState<SavingsAccount | null>(null)

  const totalBase = useMemo(() => {
    const a = totalSavingsAccountsBalanceInBase(savingsAccounts, settings.baseCurrency, exchangeRates)
    const h = totalSavingsHoldingsInBase(savingsHoldings, settings.baseCurrency, exchangeRates)
    return a + h
  }, [savingsAccounts, savingsHoldings, settings.baseCurrency, exchangeRates])

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

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <PageHeaderContent className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-brand-text-primary)] flex items-center gap-2">
              <HandCoins className="w-6 h-6 text-[var(--color-brand-red)]" />
              {t.savings.pageTitle}
            </h1>
            <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
              {t.savings.totalLine(settings.baseCurrency)}
              <span className="font-mono-numbers text-[var(--color-brand-green)]">
                {formatCurrency(totalBase, settings.baseCurrency)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => guard(() => setWithdrawOpen(true))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] px-4 py-2 text-sm font-medium text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]"
            >
              <Minus className="h-4 w-4" />
              {t.savings.withdraw}
            </button>
            <button
              type="button"
              onClick={() => guard(() => setAddOpen(true))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-brand-green)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t.savings.addToSavings}
            </button>
          </div>
        </PageHeaderContent>
      </PageHeader>

      <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => guard(() => setNewAccountOpen(true))}
            className="text-sm font-medium text-[var(--color-brand-red)] hover:underline"
          >
            + {t.savings.addAccount}
          </button>
        </div>

        {savingsAccounts.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center space-y-3">
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
                onUpdateAutoSave={(auto) => updateSavingsAccount(acc.id, { autoSave: auto })}
                onDelete={() => {
                  if (globalThis.confirm?.(t.savings.confirmDeleteAccount)) {
                    deleteSavingsAccount(acc.id)
                  }
                }}
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
      {newAccountOpen && (
        <AddSavingsAccountSheet open onClose={() => setNewAccountOpen(false)} />
      )}
    </div>
  )
}
