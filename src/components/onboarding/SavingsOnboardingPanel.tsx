'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { SavingsAccountCard } from '@/components/features/savings/SavingsAccountCard'
import { AddSavingsAccountSheet } from '@/components/modals/AddSavingsAccountSheet'
import { EditSavingsAccountSheet } from '@/components/modals/EditSavingsAccountSheet'
import { AddToSavingsSheet } from '@/components/features/savings/AddToSavingsSheet'
import { WithdrawFromSavingsSheet } from '@/components/features/savings/WithdrawFromSavingsSheet'
import { UpdateBalanceSheet } from '@/components/features/savings/UpdateBalanceSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SavingsAccount } from '@/lib/store/types'

type SheetKind = 'add' | 'deposit' | 'withdraw' | 'update' | 'edit' | null

/**
 * Bidirectional onboarding panel for savings: reads & writes live `savingsAccounts`.
 * Every action here uses the same sheets the /savings page uses — no shadow state.
 */
export function SavingsOnboardingPanel() {
  const t = useT()
  const { savingsAccounts, depositToSavings, withdrawFromSavings, correctSavingsBalance, deleteSavingsAccount } =
    useFinanceStore(
      useShallow((s) => ({
        savingsAccounts: s.savingsAccounts,
        depositToSavings: s.depositToSavings,
        withdrawFromSavings: s.withdrawFromSavings,
        correctSavingsBalance: s.correctSavingsBalance,
        deleteSavingsAccount: s.deleteSavingsAccount,
      }))
    )
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [targetAccount, setTargetAccount] = useState<SavingsAccount | null>(null)

  const openAdd = () => {
    setTargetAccount(null)
    setSheet('add')
  }
  const openDeposit = (acc: SavingsAccount) => {
    setTargetAccount(acc)
    setSheet('deposit')
  }
  const openWithdraw = (acc: SavingsAccount) => {
    setTargetAccount(acc)
    setSheet('withdraw')
  }
  const openUpdate = (acc: SavingsAccount) => {
    setTargetAccount(acc)
    setSheet('update')
  }
  const openEdit = (acc: SavingsAccount) => {
    setTargetAccount(acc)
    setSheet('edit')
  }
  const confirmDelete = (acc: SavingsAccount) => {
    if (globalThis.confirm?.(t.savings.confirmDeleteSavings)) {
      deleteSavingsAccount(acc.id)
    }
  }
  const close = () => {
    setSheet(null)
    setTargetAccount(null)
  }

  return (
    <div className="w-full space-y-3 text-start">
      {savingsAccounts.length === 0 ? (
        <EmptyState title={t.savings.emptyAccounts} />
      ) : (
        <div className="space-y-4">
          {savingsAccounts.map((acc) => (
            <SavingsAccountCard
              key={acc.id}
              account={acc}
              onAdd={() => openDeposit(acc)}
              onWithdraw={() => openWithdraw(acc)}
              onUpdateBalance={() => openUpdate(acc)}
              onEdit={() => openEdit(acc)}
              onDelete={() => confirmDelete(acc)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openAdd}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-brand-border)] px-4 py-3 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)] transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden />
        {t.savings.addAccount}
      </button>

      {sheet === 'add' && <AddSavingsAccountSheet open onClose={close} />}
      {sheet === 'edit' && (
        <EditSavingsAccountSheet open account={targetAccount} onClose={close} />
      )}
      {sheet === 'deposit' && (
        <AddToSavingsSheet
          open
          onClose={close}
          accounts={savingsAccounts}
          defaultAccountId={targetAccount?.id ?? null}
          onDeposit={(id, amt, cur, notes) => depositToSavings(id, amt, cur, notes)}
        />
      )}
      {sheet === 'withdraw' && (
        <WithdrawFromSavingsSheet
          open
          onClose={close}
          accounts={savingsAccounts}
          defaultAccountId={targetAccount?.id ?? null}
          onWithdraw={(id, amt, cur, notes) => withdrawFromSavings(id, amt, cur, notes)}
        />
      )}
      {sheet === 'update' && targetAccount && (
        <UpdateBalanceSheet
          key={targetAccount.id}
          open
          onClose={close}
          account={targetAccount}
          onCorrect={(nb, notes) => correctSavingsBalance(targetAccount.id, nb, notes)}
        />
      )}
    </div>
  )
}
