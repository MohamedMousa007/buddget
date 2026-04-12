'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { calculateDebtRemaining, totalPaidTowardDebt } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency, Debt, DebtPayment } from '@/lib/store/types'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useT } from '@/lib/i18n'

function lastActivityDate(debt: Debt, payments: DebtPayment[]): string {
  const dates = payments.filter((p) => p.debtId === debt.id).map((p) => p.date)
  if (dates.length === 0) return debt.createdAt
  return [...dates].sort().reverse()[0] ?? debt.createdAt
}

function debtTypeLabel(
  debt: Debt,
  tr: {
    debtTypePersonal: string
    debtTypeInstallment: string
    debtTypeGeneral: string
    debtTypeLegacy: string
  }
): string {
  if (debt.debtType === 'installment') return tr.debtTypeInstallment
  if (debt.debtType === 'general') return tr.debtTypeGeneral
  if (debt.debtType === 'personal') return tr.debtTypePersonal
  return tr.debtTypeLegacy
}

export interface DebtHistoryTableProps {
  debts: Debt[]
  debtPayments: DebtPayment[]
}

/**
 * Full debt ledger: active and cleared, with expandable payment rows.
 */
export function DebtHistoryTable({ debts, debtPayments }: DebtHistoryTableProps) {
  const t = useT()
  const { formatDateShort } = useLocalizedFormatters()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...debts].sort((a, b) => {
      const key = (d: Debt) => {
        if (d.status === 'cleared' && d.clearedAt) return d.clearedAt
        return lastActivityDate(d, debtPayments)
      }
      return key(b).localeCompare(key(a))
    })
  }, [debts, debtPayments])

  if (sorted.length === 0) return null

  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        {t.debts.debtHistorySectionTitle}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)] border-b border-[var(--color-brand-border)]">
              <th className="py-2 pe-2">{t.debts.historyColDebt}</th>
              <th className="py-2 pe-2">{t.debts.historyColType}</th>
              <th className="py-2 pe-2">{t.debts.historyColTotal}</th>
              <th className="py-2 pe-2">{t.debts.historyColPaid}</th>
              <th className="py-2 pe-2">{t.debts.historyColStatus}</th>
              <th className="py-2">{t.debts.historyColSettled}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((debt) => {
              const payments = debtPayments.filter((p) => p.debtId === debt.id)
              const paid = totalPaidTowardDebt(debt.id, debtPayments)
              const remaining = calculateDebtRemaining(debt, payments)
              const cleared = debt.status === 'cleared'
              const isMuted = cleared
              const expanded = expandedId === debt.id
              return (
                <DebtHistoryRow
                  key={debt.id}
                  debt={debt}
                  payments={payments}
                  paid={paid}
                  remaining={remaining}
                  cleared={cleared}
                  isMuted={isMuted}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : debt.id)}
                  formatDateShort={formatDateShort}
                  typeLabel={debtTypeLabel(debt, t.debts)}
                  tr={t.debts}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DebtHistoryRow({
  debt,
  payments,
  paid,
  remaining,
  cleared,
  isMuted,
  expanded,
  onToggle,
  formatDateShort,
  typeLabel,
  tr,
}: {
  debt: Debt
  payments: DebtPayment[]
  paid: number
  remaining: number
  cleared: boolean
  isMuted: boolean
  expanded: boolean
  onToggle: () => void
  formatDateShort: (iso: string) => string
  typeLabel: string
  tr: {
    statusCleared: string
    statusInProgress: string
    labelStillToGo: string
    colDate: string
  }
}) {
  const rowCls = isMuted ? 'opacity-75 text-[var(--color-brand-text-muted)]' : 'text-white'

  return (
    <>
      <tr
        className={`border-b border-[var(--color-brand-border)]/60 cursor-pointer hover:bg-[var(--color-brand-elevated)]/30 ${rowCls}`}
        onClick={onToggle}
      >
        <td className="py-3 pe-2">
          <div className="flex items-center gap-2 min-w-[120px]">
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            <span className="text-lg shrink-0">{debt.emoji || (debt.isGold ? '🪙' : '💵')}</span>
            <span className="font-medium truncate">{debt.name}</span>
          </div>
        </td>
        <td className="py-3 pe-2 text-[var(--color-brand-text-secondary)]">{typeLabel}</td>
        <td className="py-3 pe-2 font-mono-numbers">
          {debt.isGold ? `${debt.startingBalance.toFixed(2)}g` : formatCurrency(debt.startingBalance, debt.currency)}
        </td>
        <td className="py-3 pe-2 font-mono-numbers">
          {debt.isGold ? `${paid.toFixed(2)}g` : formatCurrency(paid, debt.currency)}
        </td>
        <td className="py-3 pe-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              cleared
                ? 'bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)]'
                : 'bg-[var(--color-brand-amber)]/10 text-[var(--color-brand-amber)]'
            }`}
          >
            {cleared ? tr.statusCleared : tr.statusInProgress}
          </span>
        </td>
        <td className="py-3 font-mono-numbers text-[var(--color-brand-text-secondary)]">
          {debt.clearedAt ? formatDateShort(debt.clearedAt) : '—'}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-[var(--color-brand-elevated)]/20">
          <td colSpan={6} className="px-4 pb-4 pt-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-2">
              {debt.name} — {tr.colDate}
            </p>
            {payments.length === 0 ? (
              <p className="text-xs text-[var(--color-brand-text-muted)]">—</p>
            ) : (
              <ul className="space-y-1">
                {payments
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => {
                    const payCur = (p.paymentCurrency as Currency | undefined) ?? debt.currency
                    const showAmt = p.originalAmount ?? p.amountPaid
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap justify-between gap-2 text-xs text-[var(--color-brand-text-secondary)]"
                      >
                        <span>{formatDateShort(p.date)}</span>
                        <span className="font-mono-numbers">
                          {debt.isGold ? `${p.amountPaid.toFixed(2)}g` : formatCurrency(showAmt, payCur)}
                        </span>
                        {p.notes ? <span className="w-full text-[var(--color-brand-text-muted)]">{p.notes}</span> : null}
                      </li>
                    )
                  })}
              </ul>
            )}
            {!cleared ? (
              <p className="text-xs text-[var(--color-brand-text-muted)] mt-2">
                {tr.labelStillToGo}:{' '}
                {debt.isGold ? `${remaining.toFixed(2)}g` : formatCurrency(remaining, debt.currency)}
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}
