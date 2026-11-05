'use client'

import { useMemo, useState } from 'react'
import { parseISO } from 'date-fns'
import { ShoppingCart, TrendingUp } from 'lucide-react'
import type { SavingsAccount, SavingsTransaction, Currency } from '@/lib/store/types'
import { tryConvertCurrency, tryConvertWithGold } from '@/lib/utils/currency'
import { useGoldQuote } from '@/hooks/useGoldQuote'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor } from '@/lib/savings/pocketIdentity'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { rgba } from '@/lib/utils/color'
import { Button } from '@/components/ui/button'
import { catForAccount, type CatKey } from '@/lib/savings/wealthModel'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock, formatLocalized } from '@/lib/i18n/dateFormat'
import { useActionToast } from '@/components/ui/ActionToast'
import { formatCurrency } from '@/lib/utils/formatters'

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`

type TagKind = 'carry' | 'moved' | 'saved' | 'withdrew'

/** The coloured tag under each row's icon, derived from the transaction's kind/source. */
function tagFor(tx: SavingsTransaction): { kind: TagKind; color: string; sign: 1 | -1 } {
  if (tx.source === 'carry') return { kind: 'carry', color: 'var(--color-brand-gold)', sign: 1 }
  if (tx.transferGroupId) return { kind: 'moved', color: 'var(--color-brand-primary-ink)', sign: tx.type === 'deposit' ? 1 : -1 }
  if (tx.type === 'deposit') return { kind: 'saved', color: 'var(--color-brand-green)', sign: 1 }
  return { kind: 'withdrew', color: 'var(--color-brand-red)', sign: -1 }
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
  const tagLabel: Record<TagKind, string> = { carry: t.ledgerMonthEnd, moved: t.ledgerMoved, saved: t.ledgerSaved, withdrew: t.ledgerWithdrew }
  const { locale } = useLocale()
  const deleteTx = useFinanceStore((s) => s.deleteSavingsTransaction)
  const showToast = useActionToast()
  const onDelete = (id: string) => {
    const res = deleteTx(id)
    if (res.ok || res.reason !== 'would_go_negative') return
    const pocket = accounts.find((a) => a.id === res.accountId)
    showToast(t.deleteBlocked(pocket?.name ?? '', formatCurrency(res.shortBy, pocket?.currency ?? baseCurrency)))
  }
  const gold = useGoldQuote()
  const inBase = (tx: SavingsTransaction) =>
    tryConvertWithGold(tx.amount, tx.currency, baseCurrency, exchangeRates, baseCurrency, gold)
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
        <h2 className="mb-2 px-4 text-[17px] lg:px-0 font-bold text-[var(--color-brand-text-primary)]">{t.recentMoves}</h2>
        <div className="px-1 py-10 text-center">
          <p className="text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
        </div>
      </div>
    )
  }

  const dayTotal = (rows: SavingsTransaction[]) =>
    rows.reduce((s, r) => {
      const tag = tagFor(r)
      return s + tag.sign * (inBase(r) ?? 0)
    }, 0)

  return (
    <div className="mt-2">
      <div className="mb-2 flex items-center justify-between px-4 lg:px-0">
        <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">
          {t.recentMoves}{filter ? ` · ${t.catLabels[filter]}` : ''}
        </h2>
        {onSeeAll ? <Button variant="link" size="touch" onClick={onSeeAll}>{t.seeAll}</Button> : null}
      </div>

      {days.map(([day, rows]) => (
        <div key={day} className="mt-3 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[var(--color-brand-border)] lg:bg-[var(--color-brand-card)]">
          <div className="flex items-center justify-between px-4 pb-1">
            <span className="text-sm font-bold text-[var(--color-brand-text-primary)]">{formatLocalized(new Date(day + 'T12:00:00'), 'MMM d', locale)}</span>
            <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{fmtSigned(dayTotal(rows))}.00 {baseCurrency}</span>
          </div>
          {rows.map((tx) => {
            const a = acc(tx.accountId)
            const tag = tagFor(tx)
            const amtBase = inBase(tx) ?? 0
            const usd = tryConvertCurrency(amtBase, baseCurrency, 'USD', exchangeRates) ?? 0
            const time = formatClock(new Date(tx.date.length > 10 ? tx.date : tx.date + 'T12:00:00'), locale)
            return (
              <SwipeToDelete key={tx.id} onDelete={() => onDelete(tx.id)} openSide={openId === tx.id ? 'left' : null} onOpenChange={(side) => setOpenId(side ? tx.id : null)} deleteLabel="Delete">
                <div className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] lg:bg-transparent">
                  <TransactionRow
                    icon={a ? <SavingsAccountIcon account={a} className="h-5 w-5" /> : tag.kind === 'withdrew' ? <ShoppingCart size={18} /> : <TrendingUp size={18} />}
                    iconBg={a ? rgba(pocketColor(a), .14) : 'var(--color-brand-elevated)'}
                    iconFg={a ? pocketColor(a) : undefined}
                    caption={tagLabel[tag.kind]}
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
