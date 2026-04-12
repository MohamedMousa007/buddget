'use client'

import { MoreVertical, Pencil, Plus, Minus } from 'lucide-react'
import { useState } from 'react'
import type { SavingsAccount, SavingsAutoSave } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { AutoSaveConfig } from '@/components/features/savings/AutoSaveConfig'

export interface SavingsAccountCardProps {
  account: SavingsAccount
  onAdd: () => void
  onWithdraw: () => void
  onUpdateBalance: () => void
  onUpdateAutoSave: (auto: SavingsAutoSave | undefined) => void
  onDelete: () => void
}

/**
 * Single savings goal / account with balance, goal bar, and actions.
 */
export function SavingsAccountCard({
  account,
  onAdd,
  onWithdraw,
  onUpdateBalance,
  onUpdateAutoSave,
  onDelete,
}: SavingsAccountCardProps) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const hasTarget = account.targetAmount != null && account.targetAmount > 0
  const pct =
    hasTarget && account.targetAmount
      ? Math.min(100, (account.currentBalance / account.targetAmount) * 100)
      : 0

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">
            <span className="mr-1.5">{account.emoji}</span>
            {account.name}
          </p>
          <p className="mt-1 text-2xl font-mono-numbers font-bold text-[var(--color-brand-text-primary)]">
            {formatCurrency(account.currentBalance, account.currency)}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]"
            aria-label="Menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className="w-full px-3 py-2 text-left text-xs text-[var(--color-brand-red)] hover:bg-[var(--color-brand-border)]/30"
              >
                {t.common.delete}
              </button>
            </div>
          )}
        </div>
      </div>

      {hasTarget && (
        <>
          <div className="h-1.5 rounded-full bg-[var(--color-brand-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand-green)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {t.savings.ofGoal(Math.round(pct))} · {formatCurrency(account.targetAmount!, account.currency)}
          </p>
        </>
      )}

      {account.autoSave?.enabled && (
        <p className="text-xs text-[var(--color-brand-text-secondary)]">
          {t.savings.autoSave}:{' '}
          {account.autoSave.mode === 'end_of_month'
            ? t.savings.modeEndOfMonth
            : account.autoSave.mode === 'percent_of_income'
              ? `${account.autoSave.percent ?? 0}%`
              : `${formatCurrency(account.autoSave.amount ?? 0, account.currency)}`}
        </p>
      )}

      <AutoSaveConfig account={account} onChange={onUpdateAutoSave} />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-1 rounded-xl border border-[var(--color-brand-border)] py-2 text-xs font-medium text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.savings.addToSavings}
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          className="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-1 rounded-xl border border-[var(--color-brand-border)] py-2 text-xs font-medium text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <Minus className="h-3.5 w-3.5" />
          {t.savings.withdraw}
        </button>
        <button
          type="button"
          onClick={onUpdateBalance}
          className="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-1 rounded-xl border border-[var(--color-brand-border)] py-2 text-xs font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          {t.savings.updateBalance}
        </button>
      </div>
    </div>
  )
}
