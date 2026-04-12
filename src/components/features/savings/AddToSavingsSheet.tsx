'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Currency, SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export interface AddToSavingsSheetProps {
  open: boolean
  onClose: () => void
  accounts: SavingsAccount[]
  defaultAccountId: string | null
  onDeposit: (accountId: string, amount: number, currency: Currency, notes?: string) => void
}

/**
 * Deposit into a savings account (ledger only — not an expense).
 * Remount via `key` on the parent when opening so fields reset.
 */
export function AddToSavingsSheet({
  open,
  onClose,
  accounts,
  defaultAccountId,
  onDeposit,
}: AddToSavingsSheetProps) {
  const t = useT()
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const acc = accounts.find((a) => a.id === accountId)

  if (!open) return null

  const submit = () => {
    const n = parseFloat(amount)
    if (!acc || !Number.isFinite(n) || n <= 0) return
    onDeposit(acc.id, n, acc.currency, notes.trim() || undefined)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetAddTitle} onClose={onClose} />
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              {t.savings.labelWhichAccount}
            </Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name} ({formatCurrency(a.currentBalance, a.currency)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelAmount}</Label>
            <div className="mt-1 flex gap-2 items-center">
              <span className="flex h-10 min-w-[4rem] items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm font-mono-numbers">
                {acc?.currency ?? '—'}
              </span>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
          <button
            type="button"
            onClick={submit}
            disabled={!acc}
            className="mt-2 w-full rounded-xl bg-[var(--color-brand-red)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40"
          >
            {t.savings.submitAdd}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
