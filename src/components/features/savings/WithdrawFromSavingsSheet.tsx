'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Currency, SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export interface WithdrawFromSavingsSheetProps {
  open: boolean
  onClose: () => void
  accounts: SavingsAccount[]
  defaultAccountId: string | null
  onWithdraw: (accountId: string, amount: number, currency: Currency, notes?: string) => void
}

/**
 * Withdraw from savings (ledger only — not income).
 */
export function WithdrawFromSavingsSheet({
  open,
  onClose,
  accounts,
  defaultAccountId,
  onWithdraw,
}: WithdrawFromSavingsSheetProps) {
  const t = useT()
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const acc = accounts.find((a) => a.id === accountId)

  if (!open) return null

  const n = parseFloat(amount)
  const valid = acc && Number.isFinite(n) && n > 0 && n <= acc.currentBalance + 0.0001

  const submit = () => {
    if (!valid || !acc) return
    onWithdraw(acc.id, n, acc.currency, notes.trim() || undefined)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetWithdrawTitle} onClose={onClose} />
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">
              {t.savings.labelWhichSavings}
            </Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full h-10 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.currentBalance, a.currency)})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            {t.savings.available}{' '}
            <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
              {acc ? formatCurrency(acc.currentBalance, acc.currency) : '—'}
            </span>
          </p>
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
          {acc && Number.isFinite(n) && n > acc.currentBalance + 0.0001 && (
            <p className="text-xs text-[var(--color-brand-red)]">{t.savings.exceedsBalance}</p>
          )}
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.savings.labelReason}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full min-h-[4.5rem] resize-y rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand-red)]/30"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="mt-2 w-full rounded-xl bg-[#E50914] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 transition-colors"
          >
            {t.savings.submitWithdraw}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
