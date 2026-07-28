'use client'

import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { ArrowRightLeft, Funnel, ShoppingCart, TrendingUp } from 'lucide-react'
import type { SavingsAccount, SavingsTransaction, Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor } from '@/lib/savings/pocketIdentity'

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`
const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}` }

/** The coloured tag under each row's icon, derived from the transaction's kind/source. */
function tagFor(tx: SavingsTransaction): { label: string; color: string; sign: 1 | -1 } {
  if (tx.source === 'carry') return { label: 'Month end', color: '#F5C842', sign: 1 }
  if (tx.transferGroupId) return { label: 'Moved', color: '#7EAEF9', sign: tx.type === 'deposit' ? 1 : -1 }
  if (tx.type === 'deposit') return { label: 'Saved', color: '#35D46F', sign: 1 }
  return { label: 'Withdrew', color: '#FF6B6B', sign: -1 }
}

const FILTERS = [
  { key: 'pocket', label: 'Pocket', icon: <span className="grid grid-cols-2 gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className="h-1 w-1 rounded-[1px] bg-current" />)}</span> },
  { key: 'kind', label: 'Kind', icon: <ArrowRightLeft size={14} /> },
  { key: 'amount', label: 'Amount', icon: <span className="font-mono-numbers text-xs">$</span> },
] as const

export interface ActivityLedgerProps {
  transactions: SavingsTransaction[]
  accounts: SavingsAccount[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  /** Investment mode shows invested rows; savings shows saved/withdrawn/month-end. */
  mode?: 'savings' | 'investment'
}

export function ActivityLedger({ transactions, accounts, baseCurrency, exchangeRates }: ActivityLedgerProps) {
  const acc = (id: string) => accounts.find((a) => a.id === id)

  const days = useMemo(() => {
    const rows = [...transactions].filter((t) => t.isCashFlow !== false || t.source === 'carry')
    rows.sort((a, b) => parseISO(b.date.slice(0, 10)).getTime() - parseISO(a.date.slice(0, 10)).getTime())
    const groups = new Map<string, SavingsTransaction[]>()
    for (const r of rows) {
      const day = r.date.slice(0, 10)
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(r)
    }
    return [...groups.entries()]
  }, [transactions])

  if (transactions.length === 0) {
    return (
      <div className="mx-4 mt-2">
        <h2 className="mb-2 text-[15px] font-bold text-[var(--color-brand-text-primary)]">Activity</h2>
        <p className="text-sm text-[var(--color-brand-text-muted)]">Nothing here yet</p>
      </div>
    )
  }

  const dayTotal = (rows: SavingsTransaction[]) =>
    rows.reduce((s, r) => {
      const tag = tagFor(r)
      return s + tag.sign * convertCurrency(r.amount, r.currency, baseCurrency, exchangeRates)
    }, 0)

  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-[15px] font-bold text-[var(--color-brand-text-primary)]">Activity</h2>
      </div>

      {/* filter chips + funnel */}
      <div className="flex items-center gap-2 px-4">
        <div className="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-brand-text-secondary)]">
              {f.icon}{f.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Filters" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
          <Funnel size={16} />
        </button>
      </div>

      {days.map(([day, rows]) => (
        <div key={day} className="mt-3">
          <div className="flex items-center justify-between px-4 pb-1">
            <span className="text-sm font-bold text-[var(--color-brand-text-primary)]">{new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{fmtSigned(dayTotal(rows))}.00 {baseCurrency}</span>
          </div>
          {rows.map((tx) => {
            const a = acc(tx.accountId)
            const tag = tagFor(tx)
            const amtBase = convertCurrency(tx.amount, tx.currency, baseCurrency, exchangeRates)
            const usd = convertCurrency(amtBase, baseCurrency, 'USD', exchangeRates)
            return (
              <div key={tx.id} className="flex items-center gap-3 border-t border-[var(--color-brand-border)] px-4 py-3">
                <div className="flex w-[46px] flex-col items-center gap-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: a ? `rgba(${hexToRgb(pocketColor(a))},.14)` : 'var(--color-brand-elevated)', color: a ? pocketColor(a) : undefined }}>
                    {a ? <SavingsAccountIcon account={a} className="h-5 w-5" /> : tag.label === 'Withdrew' ? <ShoppingCart size={18} /> : <TrendingUp size={18} />}
                  </span>
                  <span className="text-[9.5px] font-semibold" style={{ color: tag.color }}>{tag.label}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{a?.name ?? 'Savings'}</p>
                  <p className="truncate text-xs text-[var(--color-brand-text-muted)]">
                    {new Date(tx.date.length > 10 ? tx.date : tx.date + 'T12:00:00').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {tx.notes || tx.source || a?.institution || 'Savings'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono-numbers text-[15px] font-semibold" style={{ color: tag.sign > 0 ? '#35D46F' : '#FF6B6B' }}>{fmtSigned(tag.sign * amtBase)}.00</p>
                  <p className="font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">≈ ${Math.abs(usd).toFixed(2)}</p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
