'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'

export interface UpdateBalanceSheetProps {
  open: boolean
  onClose: () => void
  account: SavingsAccount | null
  onCorrect: (newBalance: number, notes?: string) => void
}

/**
 * Manual balance correction with ledger entry for the difference.
 * Remount via `key` when opening so fields reset.
 */
export function UpdateBalanceSheet({ open, onClose, account, onCorrect }: UpdateBalanceSheetProps) {
  const t = useT()
  const [balance, setBalance] = useState(() => (account ? String(account.currentBalance) : ''))
  const [notes, setNotes] = useState('')

  if (!open || !account) return null

  const nb = parseFloat(balance)
  const diff = Number.isFinite(nb) ? nb - account.currentBalance : 0
  const canSubmit = Number.isFinite(nb) && nb >= 0 && Math.abs(diff) > 0.0001

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-5 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetUpdateTitle} onClose={onClose} />
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-brand-text-primary)]">
          <SavingsAccountIcon account={account} className="h-5 w-5 shrink-0" />
          <span>{account.name}</span>
        </p>
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
          {t.savings.currentBalanceLabel}{' '}
          <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
            {formatCurrency(account.currentBalance, account.currency)}
          </span>
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              {t.savings.labelNewBalance}
            </Label>
            <div className="mt-1 flex gap-2 items-center">
              <span className="flex h-10 min-w-[4rem] items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm font-mono-numbers">
                {account.currency}
              </span>
              <Input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="h-10 flex-1 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelNotes}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-10 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
            />
          </div>
          {Number.isFinite(diff) && Math.abs(diff) > 0.0001 && (
            <p
              className={`text-xs font-mono-numbers ${
                diff > 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-amber)]'
              }`}
            >
              {diff > 0 ? t.savings.differenceDeposit : t.savings.differenceWithdrawal}{' '}
              {formatCurrency(Math.abs(diff), account.currency)}
            </p>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return
              onCorrect(nb, notes.trim() || undefined)
              onClose()
            }}
            className="w-full rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40"
          >
            {t.savings.submitUpdate}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
