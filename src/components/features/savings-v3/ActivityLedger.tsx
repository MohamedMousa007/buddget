'use client'

import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Gem, TrendingUp } from 'lucide-react'
import type { InvestmentHolding, SavingsAccount, SavingsTransaction, Currency } from '@/lib/store/types'
import { tryConvertWithGold } from '@/lib/utils/currency'
import { useGoldQuote } from '@/hooks/useGoldQuote'
import { SavingsAccountIcon } from '@/components/features/savings/SavingsAccountIcon'
import { pocketColor } from '@/lib/savings/pocketIdentity'
import { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { mix, rgba } from '@/lib/utils/color'
import { Button } from '@/components/ui/button'
import type { CatKey } from '@/lib/savings/wealthModel'
import { activityMoves } from '@/lib/savings/activityMoves'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock, formatLocalized, type AppLocale } from '@/lib/i18n/dateFormat'
import { useActionToast } from '@/components/ui/ActionToast'
import { formatWhole } from '@/lib/utils/formatters'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { accountTitle } from '@/lib/accounts/accountTitle'
import { useWealthLtCopy } from '@/lib/i18n/wealthLtCopy'
import { holdingFundedBy } from '@/lib/savings/assetPurchase'
import { deleteHoldingWithUndo } from '@/lib/savings/pocketUndo'
import { instantOf } from '@/lib/accounts/balance'

/** A move's clock time: its stored instant, else noon of its day (rows that predate `occurredAt`). */
export function ledgerClock(tx: Pick<SavingsTransaction, 'date' | 'occurredAt'>, locale: AppLocale): string {
  return formatClock(new Date(instantOf(tx.occurredAt, tx.date)), locale)
}

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`

/** The month a carry row belongs to, read from its `… · YYYY-MM` note. */
const carryMonth = (tx: SavingsTransaction) => (tx.source === 'carry' ? tx.notes?.match(/(\d{4}-\d{2})\s*$/)?.[1] : undefined)

type TagKind = 'carry' | 'moved' | 'saved' | 'withdrew'

/** The coloured tag under each row's icon, derived from the transaction's kind/source. */
function tagFor(tx: SavingsTransaction): { kind: TagKind; color: string; sign: 1 | -1 } {
  if (tx.source === 'carry') return { kind: 'carry', color: 'var(--color-brand-gold)', sign: tx.type === 'deposit' ? 1 : -1 }
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
  /** Months whose carry is out of date: their carry rows get an "Out of date" badge. */
  staleMonthKeys?: string[]
}

export function ActivityLedger({ transactions, accounts, baseCurrency, exchangeRates, limit, filter, onSeeAll, staleMonthKeys = [] }: ActivityLedgerProps) {
  const t = useT().wealthPage
  const tagLabel: Record<TagKind, string> = { carry: t.ledgerMonthEnd, moved: t.ledgerMoved, saved: t.ledgerSaved, withdrew: t.ledgerWithdrew }
  const lt = useWealthLtCopy()
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const { locale } = useLocale()
  const deleteTx = useFinanceStore((s) => s.deleteSavingsTransaction)
  const showToast = useActionToast()
  const holdings = useFinanceStore((s) => s.investmentHoldings)
  const expenses = useFinanceStore((s) => s.expenses)
  const { lookup } = useAssetPrices()
  const onDeleteBuy = (h: InvestmentHolding) => showToast(t.deletedToast(h.name), { undo: deleteHoldingWithUndo(h.id), undoLabel: t.deleteUndo })
  const onDelete = (id: string) => {
    // A withdrawal that bought an asset goes with the asset, and Undo brings both back.
    const bought = holdingFundedBy(useFinanceStore.getState().investmentHoldings, id)
    if (bought) return onDeleteBuy(bought)
    const res = deleteTx(id)
    if (res.ok || res.reason !== 'would_go_negative') return
    const pocket = accounts.find((a) => a.id === res.accountId)
    showToast(t.deleteBlocked(pocket?.name ?? '', `${formatWhole(res.shortBy)} ${pocket?.currency ?? baseCurrency}`))
  }
  const gold = useGoldQuote()
  const inBase = (tx: SavingsTransaction) =>
    tryConvertWithGold(tx.amount, tx.currency, baseCurrency, exchangeRates, baseCurrency, gold)
  const [openId, setOpenId] = useState<string | null>(null)
  const acc = (id: string) => accounts.find((a) => a.id === id)

  const rows = useMemo(
    () => activityMoves({ transactions, holdings, expenses, accounts, filter, limit }),
    [transactions, holdings, expenses, accounts, filter, limit],
  )

  const head = (
    <div className="mb-1 flex min-h-11 items-center justify-between ps-1">
      <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
        {lt.activity}{filter ? ` · ${t.catLabels[filter]}` : ''}
      </h2>
      {onSeeAll ? <Button variant="link" size="touch" onClick={onSeeAll}>{t.seeAll}</Button> : null}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="px-4 lg:px-0">
        {head}
        <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
      </div>
    )
  }

  const titleOf = (tx: SavingsTransaction, kind: TagKind, name: string) => {
    if (kind === 'carry') return `${tagLabel.carry} · ${name}`
    if (kind === 'moved') return tx.type === 'deposit' ? lt.movedTo(name) : lt.movedFrom(name)
    return tx.type === 'deposit' ? lt.depositTo(name) : lt.withdrewFrom(name)
  }
  const whereOf = (tx: SavingsTransaction) => {
    const pm = tx.paymentMethodId ? paymentMethods.find((m) => m.id === tx.paymentMethodId) : undefined
    if (pm) return tx.type === 'deposit' ? lt.from(accountTitle(pm)) : lt.to(accountTitle(pm))
    return tx.notes || ledgerClock(tx, locale)
  }

  /** What a buy cost (paid from an account, so it left that account), else what it is worth today (new money from outside). */
  const buyAmount = (h: InvestmentHolding, paid: boolean): number | null => {
    if (paid && h.unitCost != null) return tryConvertWithGold(h.unitCost * h.quantity, h.costBasisCurrency ?? h.currency, baseCurrency, exchangeRates, baseCurrency, gold)
    const worth = valueInvestmentHolding(h, lookup).value
    return worth == null ? null : tryConvertWithGold(worth, 'EGP', baseCurrency, exchangeRates, baseCurrency, gold)
  }

  return (
    <div className="px-4 lg:px-0">
      {head}
      <Card padding="none" className="overflow-hidden rounded-2xl">
        {rows.map((move, i) => {
          const divider = i > 0 ? <div aria-hidden className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null
          const day = formatLocalized(new Date(move.at), 'MMM d', locale)
          if (move.kind === 'buy') {
            const h = move.holding
            const paid = !!move.paidFromAccountId
            const pm = paid ? paymentMethods.find((m) => m.id === move.paidFromAccountId) : undefined
            const amt = buyAmount(h, paid)
            const gem = h.assetType === 'gold'
            return (
              <SwipeToDelete key={move.id} onDelete={() => onDeleteBuy(h)} openSide={openId === move.id ? 'left' : null} onOpenChange={(side) => setOpenId(side ? move.id : null)} deleteLabel="Delete">
                <div className="bg-[var(--color-brand-card)]">
                  {divider}
                  <TransactionRow
                    icon={gem ? <Gem className="size-5" /> : <TrendingUp className="size-5" />}
                    iconBg={gem ? mix('var(--color-brand-gold)', 16) : 'var(--color-brand-elevated)'}
                    iconFg={gem ? 'var(--color-brand-gold)' : undefined}
                    title={gem ? lt.boughtGold(h.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })) : lt.bought(h.name)}
                    subtitle={`${day} · ${pm ? accountTitle(pm) : lt.outside}`}
                    amount={amt == null ? '—' : <>{fmtSigned(paid ? -amt : amt)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{baseCurrency}</span></>}
                    amountColor={!paid && amt != null ? 'var(--color-brand-green)' : undefined}
                  />
                </div>
              </SwipeToDelete>
            )
          }
          const tx = move.tx
          const a = acc(tx.accountId)
          const tag = tagFor(tx)
          const amtBase = inBase(tx) ?? 0
          return (
            <SwipeToDelete key={tx.id} onDelete={() => onDelete(tx.id)} openSide={openId === tx.id ? 'left' : null} onOpenChange={(side) => setOpenId(side ? tx.id : null)} deleteLabel="Delete">
              <div className="bg-[var(--color-brand-card)]">
                {divider}
                <TransactionRow
                  icon={tag.sign > 0 ? <ArrowDownLeft className="size-5" /> : a ? <SavingsAccountIcon account={a} className="h-5 w-5" /> : <ArrowUpRight className="size-5" />}
                  iconBg={tag.sign > 0 ? 'var(--color-brand-green-soft)' : a ? rgba(pocketColor(a), .14) : 'var(--color-brand-elevated)'}
                  iconFg={tag.sign > 0 ? 'var(--color-brand-green)' : a ? pocketColor(a) : undefined}
                  title={titleOf(tx, tag.kind, a?.name ?? 'Savings')}
                  titleBadge={staleMonthKeys.includes(carryMonth(tx) ?? '') ? <Badge tone="warn" size="xs">{t.carryOutOfDate}</Badge> : undefined}
                  subtitle={`${day} · ${whereOf(tx)}`}
                  amount={<>{fmtSigned(tag.sign * amtBase)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{baseCurrency}</span></>}
                  amountColor={tag.sign > 0 ? 'var(--color-brand-green)' : undefined}
                />
              </div>
            </SwipeToDelete>
          )
        })}
      </Card>
    </div>
  )
}
