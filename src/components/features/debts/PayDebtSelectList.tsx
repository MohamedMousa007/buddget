'use client'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateDebtRemaining } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Debt } from '@/lib/store/types'
import { useT } from '@/lib/i18n'

interface PayDebtSelectListProps {
  debts: Debt[]
  onSelect: (debtId: string) => void
}

/**
 * Step one of “Pay a debt”: pick which active debt to pay.
 */
export function PayDebtSelectList({ debts, onSelect }: PayDebtSelectListProps) {
  const t = useT()
  const debtPayments = useFinanceStore((s) => s.debtPayments)

  if (debts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-brand-text-muted)] py-4 text-center">{t.addDebtPayment.allCleared}</p>
    )
  }

  return (
    <ul className="space-y-2">
      {debts.map((d) => {
        const pays = debtPayments.filter((p) => p.debtId === d.id)
        const rem = calculateDebtRemaining(d, pays)
        const emoji = d.emoji || (d.isGold ? '🪙' : '💵')
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-4 py-3 text-left hover:bg-[var(--color-brand-elevated)]/70 transition-colors"
            >
              <span className="text-lg shrink-0">{emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[var(--color-brand-text-primary)] truncate">{d.name}</span>
              </span>
              <span className="text-sm font-mono-numbers text-[var(--color-brand-text-secondary)] shrink-0">
                {d.isGold ? `${rem.toFixed(2)}g` : formatCurrency(rem, d.currency)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
