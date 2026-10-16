'use client'

import { useMemo, useState } from 'react'
import { parseISO } from 'date-fns'
import { ShoppingCart, TrendingUp } from 'lucide-react'
import type { SavingsAccount, SavingsTransaction, Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor } from '@/lib/savings/pocketIdentity'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { rgba } from '@/lib/utils/color'
import { Button } from '@/components/ui/button'
import { catForAccount, type CatKey } from '@/lib/savings/wealthModel'
import { useT } from '@/lib/i18n'

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`

/** The coloured tag under each row's icon, derived from the transaction's kind/source. */
function tagFor(tx: SavingsTransaction): { label: string; color: string; sign: 1 | -1 } {
  if (tx.source === 'carry') return { label: 'Month end', color: 'var(--color-brand-gold)', sign: 1 }
  if (tx.transferGroupId) return { label: 'Moved', color: 'var(--color-brand-primary-ink)', sign: tx.type === 'deposit' ? 1 : -1 }
  if (tx.type === 'deposit') return { label: 'Saved', color: 'var(--color-brand-green)', sign: 1 }
  return { label: 'Withdrew', color: 'var(--color-brand-red)', sign: -1 }
}

export interface ActivityLedgerProps {
  transactions: SavingsTransaction[]
  accounts: SavingsAccount[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  /** Newest N rows (compact, as on Wealth). */
  limit?: number
  /** Only moves on accounts of this kind. */
  filter?: CatKey | null
  onSeeAll?: () => void
}

export function ActivityLedger({ transactions, accounts, baseCurrency, exchangeRates, limit, filter, onSeeAll }: ActivityLedgerProps) {
  const t = useT().wealthPage
  const deleteTx = useFinanceStore((s) => s.deleteSavingsTransaction)
  const [openId, setOpenId] = useState<string | null>(null)
  const acc = (id: string) => accounts.find((a) => a.id === id)

  const days = useMemo(() => {
    let rows = [...transactions].filter((t) => t.isCashFlow !== false || t.source === 'carry')
    if (filter) rows = rows.filter((t) => { const a = accounts.find((x) => x.id === t.accountId); return a ? catForAccount(a) === filter : false })
    rows.sort((a, b) => parseISO(b.date.slice(0, 10)).getTime() - parseISO(a.date.slice(0, 10)).getTime())
    if (limit) rows = rows.slice(0, limit)
    const groups = new Map<string, SavingsTransaction[]>()
    for (const r of rows) {
      const day = r.date.slice(0, 10)
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(r)
    }
    return [...groups.entries()]
  }, [transactions, accounts, filter, limit])

  if (days.length === 0) {
    return (
      <div className="mt-2">
        <h2 className="mb-2 px-4 text-[17px] font-bold text-[var(--color-brand-text-primary)]">{t.recentMoves}</h2>
        <div className="px-1 py-10 text-center">
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
        </div>
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
        <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">
          {t.recentMoves}{filter ? ` · ${t.catLabels[filter]}` : ''}
        </h2>
        {onSeeAll ? <Button variant="link" size="touch" onClick={onSeeAll}>{t.seeAll}</Button> : null}
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
            const time = new Date(tx.date.length > 10 ? tx.date : tx.date + 'T12:00:00').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            return (
              <SwipeToDelete key={tx.id} onDelete={() => deleteTx(tx.id)} openSide={openId === tx.id ? 'left' : null} onOpenChange={(side) => setOpenId(side ? tx.id : null)} deleteLabel="Delete">
                <div className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-bg)]">
                  <TransactionRow
                    icon={a ? <SavingsAccountIcon account={a} className="h-5 w-5" /> : tag.label === 'Withdrew' ? <ShoppingCart size={18} /> : <TrendingUp size={18} />}
                    iconBg={a ? rgba(pocketColor(a), .14) : 'var(--color-brand-elevated)'}
                    iconFg={a ? pocketColor(a) : undefined}
                    caption={tag.label}
                    captionColor={tag.color}
                    title={a?.name ?? 'Savings'}
                    subtitle={`${time} · ${tx.notes || tx.source || a?.institution || 'Savings'}`}
                    amount={`${fmtSigned(tag.sign * amtBase)}.00`}
                    amountColor={tag.sign > 0 ? 'var(--color-brand-green)' : 'var(--color-brand-red)'}
                    sub={`≈ $${Math.abs(usd).toFixed(2)}`}
                  />
                </div>
              </SwipeToDelete>
            )
          })}
        </div>
      ))}
    </div>
  )
}
