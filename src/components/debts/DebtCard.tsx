'use client'

import { motion } from 'framer-motion'
import { Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  calculateDebtRemaining,
  goldGramsToMoney,
  isDebtFullyPaid,
} from '@/lib/utils/calculations'
import { convertCurrency } from '@/lib/utils/currency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MoneyDisplay } from '@/components/ui/MoneyDisplay'
import type { Debt, DebtPayment } from '@/lib/store/types'

interface DebtCardProps {
  debt: Debt
  payments: DebtPayment[]
  onRecordPayment: () => void
  onEdit: () => void
}

export function DebtCard({ debt, payments, onRecordPayment, onEdit }: DebtCardProps) {
  const { settings, exchangeRates, goldPricePerGram } = useFinanceStore()
  const base = settings.baseCurrency

  const paidOff = isDebtFullyPaid(debt, payments)
  const remainingRaw = calculateDebtRemaining(debt, payments)

  const startingInBase = debt.isGold
    ? goldGramsToMoney(debt.startingBalance, goldPricePerGram, debt.goldKarat)
    : convertCurrency(debt.startingBalance, debt.currency, base, exchangeRates)

  const remainingInBase = debt.isGold
    ? goldGramsToMoney(remainingRaw, goldPricePerGram, debt.goldKarat)
    : convertCurrency(remainingRaw, debt.currency, base, exchangeRates)

  const paidPercent = debt.startingBalance > 0
    ? ((debt.startingBalance - remainingRaw) / debt.startingBalance) * 100
    : 0

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl mt-0.5">{debt.isGold ? '🪙' : '💵'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-white uppercase">{debt.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
              debt.isGold
                ? 'bg-[var(--color-brand-gold)]/20 text-[var(--color-brand-gold)]'
                : 'bg-[var(--color-brand-green)]/20 text-[var(--color-brand-green)]'
            }`}>
              {debt.isGold ? `Gold ${debt.goldKarat || 24}K` : 'Cash'}
            </span>
            {paidOff ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 bg-[var(--color-brand-green)]/25 text-[var(--color-brand-green)]">
                Paid off
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Owed to {debt.person}
          </p>
          {debt.description && (
            <p className="text-xs text-[var(--color-brand-text-muted)] mt-0.5 italic">
              {debt.description}
            </p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0"
          title="Edit debt"
        >
          <Pencil className="w-3.5 h-3.5 text-[var(--color-brand-text-muted)]" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">Starting</span>
          <div className="text-right">
            <MoneyDisplay
              amount={debt.startingBalance}
              currency={debt.isGold ? 'XAU' : debt.currency}
              amountInPrimary={startingInBase}
              variant="card"
              primaryClassName="text-white"
            />
            {debt.isGold && (
              <span className="text-xs text-[var(--color-brand-text-muted)] ml-1.5">
                ({debt.startingBalance}g)
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-brand-text-secondary)]">Remaining</span>
          <div className="text-right">
            <MoneyDisplay
              amount={remainingRaw}
              currency={debt.isGold ? 'XAU' : debt.currency}
              amountInPrimary={remainingInBase}
              variant="card"
              primaryClassName="text-white font-semibold"
            />
            {debt.isGold && (
              <span className="text-xs text-[var(--color-brand-text-muted)] ml-1.5">
                ({remainingRaw.toFixed(1)}g)
              </span>
            )}
          </div>
        </div>

        <div className="h-2 bg-[var(--color-brand-border)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-brand-red)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(paidPercent, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers">
            {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </p>
          <span className="text-xs font-mono-numbers text-[var(--color-brand-text-secondary)]">
            {paidPercent.toFixed(1)}% paid
          </span>
        </div>

        {debt.isGold && (
          <p className="text-xs text-[var(--color-brand-gold)] flex items-center gap-1">
            {debt.goldKarat || 24}K gold @ {formatCurrency(goldPricePerGram * (debt.goldKarat || 24) / 24, base)}/g
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-green)] animate-pulse" />
          </p>
        )}
      </div>

      {paidOff ? (
        <p className="w-full mt-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-center text-sm text-[var(--color-brand-text-muted)]">
          Fully paid — add payments only if you edit the debt balance
        </p>
      ) : (
        <button
          type="button"
          onClick={onRecordPayment}
          className="w-full mt-4 py-2.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-medium transition-colors"
        >
          + Record Payment
        </button>
      )}
    </div>
  )
}
