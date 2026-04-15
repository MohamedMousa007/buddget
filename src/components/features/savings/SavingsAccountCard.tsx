'use client'

import { Pencil, Plus, Minus, Trash2 } from 'lucide-react'
import type { SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { SavingsCardConversionLine } from '@/components/features/savings/SavingsCardConversionLine'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export interface SavingsAccountCardProps {
  account: SavingsAccount
  onAdd: () => void
  onWithdraw: () => void
  onUpdateBalance: () => void
  onEdit: () => void
  onDelete: () => void
}

const withdrawBtnClass =
  'inline-flex flex-1 min-w-[5rem] items-center justify-center gap-1 rounded-xl bg-[var(--color-brand-red)] py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-red-hover)] transition-colors'

/**
 * Single savings bucket with balance, FX sublines, and transfer actions.
 */
export function SavingsAccountCard({
  account,
  onAdd,
  onWithdraw,
  onUpdateBalance,
  onEdit,
  onDelete,
}: SavingsAccountCardProps) {
  const t = useT()
  const settings = useFinanceStore((s) => s.settings)
  const exchangeRates = useFinanceStore((s) => s.exchangeRates)
  const goldPriceAvailable = useFinanceStore((s) => s.goldPriceAvailable)
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex gap-2">
          <SavingsAccountIcon
            account={account}
            className="mt-0.5 h-6 w-6 text-[var(--color-brand-text-primary)]"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-brand-text-primary)] truncate">
              {account.name}
            </p>
            <p className="mt-1 text-2xl font-mono-numbers font-bold text-[var(--color-brand-text-primary)]">
              {formatCurrency(account.currentBalance, account.currency)}
            </p>
            <SavingsCardConversionLine
              account={account}
              settings={settings}
              exchangeRates={exchangeRates}
              goldPriceAvailable={goldPriceAvailable !== false}
              liveCryptoLabel={t.savings.liveCryptoSoon}
              liveStocksLabel={t.savings.liveStocksSoon}
              goldAedUnavailableLabel={t.savings.goldAedUnavailable}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            title={t.common.edit}
            aria-label={t.common.edit}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-text-primary)]"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t.common.delete}
            aria-label={t.common.delete}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-red)]"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-1 rounded-xl bg-[var(--color-brand-green)] py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-green-hover)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.savings.addToSavings}
        </button>
        <button type="button" onClick={onWithdraw} className={withdrawBtnClass}>
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
