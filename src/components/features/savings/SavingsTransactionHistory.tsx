'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'

export interface SavingsTransactionHistoryProps {
  transactions: SavingsTransaction[]
  accounts: SavingsAccount[]
}

/**
 * Filterable savings ledger (deposits / withdrawals).
 */
export function SavingsTransactionHistory({ transactions, accounts }: SavingsTransactionHistoryProps) {
  const t = useT()
  const [filterId, setFilterId] = useState<string>('all')
  const filterItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: 'all', label: t.savings.filterAllSavings },
      ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ],
    [accounts, t.savings.filterAllSavings],
  )

  const sorted = useMemo(() => {
    const rows = [...transactions]
    rows.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    return filterId === 'all' ? rows : rows.filter((x) => x.accountId === filterId)
  }, [transactions, filterId])

  const accName = (id: string) => accounts.find((a) => a.id === id)

  return (
    <section className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.savings.historyTitle}
        </h2>
        <div className="w-full sm:w-56">
          <SelectField
            value={filterId}
            onChange={setFilterId}
            items={filterItems}
            aria-label={t.savings.historyTitle}
          />
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--color-brand-text-muted)] py-6 text-center">—</p>
      ) : (
        <ul className="divide-y divide-[var(--color-brand-border)]">
          {sorted.map((tx) => {
            const a = accName(tx.accountId)
            const sign = tx.type === 'deposit' ? '+' : '−'
            const color =
              tx.type === 'deposit' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-amber)]'
            return (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[var(--color-brand-text-primary)]">
                    {a ? (
                      <>
                        <SavingsAccountIcon account={a} className="h-4 w-4" />
                        <span>{a.name}</span>
                      </>
                    ) : (
                      tx.accountId
                    )}
                  </span>
                  <span className="mx-2 text-[var(--color-brand-text-muted)]">
                    {format(parseISO(tx.date.length > 10 ? tx.date : `${tx.date}T12:00:00`), 'd MMM')}
                  </span>
                  {tx.source === 'recurring_savings' && (
                    <span className="text-[10px] uppercase text-[var(--color-brand-text-muted)]">
                      {t.savings.tagRecurring}
                    </span>
                  )}
                </div>
                <div className={`font-mono-numbers shrink-0 ${color}`}>
                  {sign} {formatCurrency(tx.amount, tx.currency)}
                </div>
                <div className="w-full text-xs text-[var(--color-brand-text-muted)]">
                  {tx.type === 'deposit' ? t.savings.deposit : t.savings.withdrawal}
                  {tx.notes ? ` · ${tx.notes}` : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
