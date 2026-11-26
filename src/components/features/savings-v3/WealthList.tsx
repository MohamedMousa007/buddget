'use client'

import { Banknote, Bitcoin, FileText, Gem, House, Landmark, Plus, TrendingUp, Vault, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { pocketDisplayName, pocketIdentity } from '@/lib/savings/pocketIdentity'
import type { CatKey, WealthRowVM } from '@/lib/savings/wealthModel'
import { changePct, formatChangePct } from '@/lib/utils/changePct'
import { useWealthLtCopy, type WealthLtCopy } from '@/lib/i18n/wealthLtCopy'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized, type AppLocale } from '@/lib/i18n/dateFormat'
import { formatQuantity, formatWhole } from '@/lib/utils/formatters'

const CAT: Record<CatKey, { Icon: LucideIcon; color: string }> = {
  bank: { Icon: Landmark, color: 'var(--color-cat-1)' },
  vault: { Icon: Vault, color: 'var(--color-brand-primary)' },
  cash: { Icon: Banknote, color: 'var(--color-cat-3)' },
  certificate: { Icon: FileText, color: 'var(--color-cat-2)' },
  wallet: { Icon: Wallet, color: 'var(--color-cat-4)' },
  gold: { Icon: Gem, color: 'var(--color-brand-gold)' },
  crypto: { Icon: Bitcoin, color: 'var(--color-cat-5)' },
  stock: { Icon: TrendingUp, color: 'var(--color-cat-6)' },
  property: { Icon: House, color: 'var(--color-cat-2)' },
}

const tint = (color: string) => `color-mix(in oklab, ${color} 16%, transparent)`

export interface WealthListProps {
  rows: WealthRowVM[]
  /** The row's rect anchors its action menu. */
  onRowPress: (row: WealthRowVM, anchor: DOMRect) => void
  onAdd: () => void
  /** Pocket id → "Feeds New car · 62%". */
  goalLines?: Record<string, string>
  currency: string
}

/** Return since bought, from the holding's own cost per unit; null without a cost in the price's currency. */
export function holdingReturnPct(row: WealthRowVM): number | null {
  const h = row.holding
  if (!h || row.unitPrice == null || !h.unitCost || (h.costBasisCurrency && h.costBasisCurrency !== 'EGP')) return null
  return changePct(row.unitPrice, h.unitCost)
}

export function subtitle(row: WealthRowVM, t: ReturnType<typeof useT>['wealthPage'], identity: ReturnType<typeof useT>['savingsForms']['identity'], locale: AppLocale, goal?: string, lt?: WealthLtCopy): string {
  if (row.account) {
    // `pocketIdentity` falls back to the stored name when a pocket has no institution or type line; the row title already shows it
    // (translated), so repeating it printed "Monthly Savings" twice, and in English even on an Arabic screen.
    const id = pocketIdentity(row.account, identity, locale)
    return [id === row.account.name ? '' : id, goal].filter(Boolean).join(' · ')
  }
  const h = row.holding!
  const unit = h.assetType === 'gold' ? ' g' : h.assetType === 'property' ? ' m²' : ''
  if (row.unitPrice == null) {
    return h.assetType === 'property'
      ? `${formatQuantity(h.quantity, h.assetType)}${unit}`
      : `${formatQuantity(h.quantity, h.assetType)}${unit} · ${t.notPriced}${row.asOf ? ` · ${formatLocalized(new Date(row.asOf), 'd MMM', locale)}` : ''}`
  }
  const ret = holdingReturnPct(row)
  const since = lt && ret !== null ? lt.sinceBought(formatChangePct(ret, 1), ret >= 0) : ''
  // Light touch: the gold price lives in the gold row ("3,210 a gram · ▲ 8.1% since you bought"); grams sit in the title.
  if (lt && h.assetType === 'gold') return [lt.aGram(formatWhole(row.unitPrice)), since].filter(Boolean).join(' · ')
  const base = h.assetType === 'property' ? `${formatQuantity(h.quantity, h.assetType)}${unit}` : `${formatQuantity(h.quantity, h.assetType)}${unit} × ${formatWhole(row.unitPrice)}`
  return [base, since].filter(Boolean).join(' · ')
}

/** "Gold 21k · 18 g": a gold holding's grams ride in its title, as in the mockup. */
export function rowTitle(row: WealthRowVM, systemNames: ReturnType<typeof useT>['savingsForms']['systemNames'], lt: WealthLtCopy): string {
  if (row.account) return pocketDisplayName(row.account, systemNames)
  const h = row.holding
  return h?.assetType === 'gold' ? `${row.title} · ${lt.grams(formatQuantity(h.quantity, h.assetType))}` : row.title
}

/** Light touch Holdings: every balance and position in one rounded list; the quiet "+ Add" sits in the section head. */
export function WealthList({ rows, onRowPress, onAdd, goalLines, currency }: WealthListProps) {
  const t = useT().wealthPage
  const sf = useT().savingsForms
  const lt = useWealthLtCopy()
  const { locale } = useLocale()

  return (
    <section className="px-4 lg:px-0">
      <div className="mb-1 flex min-h-11 items-center gap-2 ps-1">
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{lt.holdings}</h2>
        <Button variant="ghost" size="touch" onClick={onAdd} aria-label={t.addPocketOrAsset}
          className="ms-auto gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:text-[var(--color-brand-primary-ink)] [&_svg:not([class*='size-'])]:size-4">
          <Plus aria-hidden />{lt.add}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
      ) : (
        <Card padding="none" className="overflow-hidden rounded-2xl">
          {rows.map((r, i) => {
            const { Icon, color } = CAT[r.cat]
            return (
              <div key={r.id} onClick={(e) => onRowPress(r, e.currentTarget.getBoundingClientRect())}>
                {i > 0 ? <div aria-hidden className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                <TransactionRow
                  icon={<Icon className="size-5" aria-hidden />}
                  iconBg={tint(color)}
                  iconFg={color}
                  title={rowTitle(r, sf.systemNames, lt)}
                  subtitle={subtitle(r, t, sf.identity, locale, goalLines?.[r.id], lt)}
                  amount={r.amount != null ? <>{formatWhole(r.amount)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{currency}</span></> : '—'}
                  onClick={() => undefined}
                  dimmed={r.amount == null}
                />
              </div>
            )
          })}
        </Card>
      )}
    </section>
  )
}
