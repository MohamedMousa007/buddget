'use client'

import { Pencil, Plus, Minus, Trash2 } from 'lucide-react'
import type { SavingsAccount } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { SavingsCardConversionLine } from '@/components/features/savings/SavingsCardConversionLine'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'

export interface SavingsAccountCardProps {
  account: SavingsAccount
  onAdd: () => void
  onWithdraw: () => void
  onUpdateBalance: () => void
  onEdit: () => void
  onDelete: () => void
}

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
  const goldPricePerGram = useFinanceStore((s) => s.goldPricePerGram)
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
              goldPricePerGram={goldPricePerGram}
              goldPriceAvailable={goldPriceAvailable !== false}
              liveCryptoLabel={t.savings.liveCryptoSoon}
              liveStocksLabel={t.savings.liveStocksSoon}
              goldAedUnavailableLabel={t.savings.goldAedUnavailable}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <IconButton onClick={onEdit} title={t.common.edit} aria-label={t.common.edit}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton variant="danger" onClick={onDelete} title={t.common.delete} aria-label={t.common.delete}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="success" size="sm" onClick={onAdd} className="min-w-[5rem] flex-1 rounded-xl">
          <Plus className="size-3.5" />
          {t.savings.addToSavings}
        </Button>
        <Button variant="destructive-solid" size="sm" onClick={onWithdraw} className="min-w-[5rem] flex-1 rounded-xl">
          <Minus className="size-3.5" />
          {t.savings.withdraw}
        </Button>
        <Button variant="outline" size="sm" onClick={onUpdateBalance} className="min-w-[5rem] flex-1 rounded-xl">
          <Pencil className="size-3.5" />
          {t.savings.updateBalance}
        </Button>
      </div>
    </div>
  )
}
