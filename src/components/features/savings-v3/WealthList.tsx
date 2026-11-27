'use client'

import { useState } from 'react'
import { Banknote, Bitcoin, ChevronDown, FileText, Gem, House, Landmark, Plus, Target, TrendingUp, Vault, Wallet, type LucideIcon } from 'lucide-react'
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
  /**
   * Pockets that hold goal money. Two or more fold into one "Goal pockets" row (the mockup lists holdings, not every
   * pocket); tapping it shows or hides them, each with its own menu as before.
   */
  goalPocketIds?: ReadonlySet<string>
  /** Section heading (v9 Savings "Investments" with its count, 17px). Default: the small-caps "Holdings". */
  heading?: { title: string; count: number; addLabel: string }
}

/** Return since bought, from the holding's own cost per unit; null without a cost in the price's currency. */
export function holdingReturnPct(row: WealthRowVM): number | null {
  const h = row.holding
  if (!h || row.unitPrice == null || !h.unitCost || (h.costBasisCurrency && h.costBasisCurrency !== 'EGP')) return null
  return changePct(row.unitPrice, h.unitCost)
}

export function subtitle(row: WealthRowVM, t: ReturnType<typeof useT>['wealthPage'], identity: ReturnType<typeof useT>['savingsForms']['identity'], locale: AppLocale, goal?: string, lt?: WealthLtCopy): string {
  if (row.account) {
    // Light touch: a savings product with a yearly return reads as its term and rate ("3 years · 17.5% a year").
    const rate = row.account.yearlyReturn
    if (lt && rate != null && rate > 0) {
      return [productTerm(row.account, lt), lt.aYear(formatRate(rate, locale)), goal].filter(Boolean).join(' · ')
    }
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

const formatRate = (pct: number, locale: AppLocale) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2, numberingSystem: 'latn' }).format(pct)

/** Whole years from opening to maturity ("3 years"), or months under a year; empty without a maturity date. */
export function productTerm(a: { createdAt?: string; maturityDate?: string }, lt: WealthLtCopy): string {
  if (!a.maturityDate || !a.createdAt) return ''
  const start = new Date(a.createdAt)
  const end = new Date(`${a.maturityDate.slice(0, 10)}T00:00:00`)
  const months = Math.round((end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth())
  if (!Number.isFinite(months) || months <= 0) return ''
  return months >= 12 && months % 12 === 0 ? lt.years(months / 12) : lt.months(months)
}

/** "Gold 21k · 18 g": a gold holding's grams ride in its title, as in the mockup. */
export function rowTitle(row: WealthRowVM, systemNames: ReturnType<typeof useT>['savingsForms']['systemNames'], lt: WealthLtCopy): string {
  if (row.account) return pocketDisplayName(row.account, systemNames)
  const h = row.holding
  return h?.assetType === 'gold' ? `${row.title} · ${lt.grams(formatQuantity(h.quantity, h.assetType))}` : row.title
}

/** Light touch Holdings: every balance and position in one rounded list; the quiet "+ Add" sits in the section head. */
export function WealthList({ rows, onRowPress, onAdd, goalLines, currency, goalPocketIds, heading }: WealthListProps) {
  const t = useT().wealthPage
  const sf = useT().savingsForms
  const lt = useWealthLtCopy()
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)

  const members = goalPocketIds ? rows.filter((r) => goalPocketIds.has(r.id)) : []
  const grouped = members.length >= 2
  const groupAt = grouped ? rows.indexOf(members[0]) : -1
  const groupTotal = members.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  type Item = { kind: 'row'; row: WealthRowVM; nested: boolean } | { kind: 'group' }
  const items: Item[] = []
  rows.forEach((r, i) => {
    if (i === groupAt) {
      items.push({ kind: 'group' })
      if (open) for (const m of members) items.push({ kind: 'row', row: m, nested: true })
    }
    if (!grouped || !goalPocketIds?.has(r.id)) items.push({ kind: 'row', row: r, nested: false })
  })
  const amountNode = (n: number | null) =>
    n != null ? <>{formatWhole(n)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{currency}</span></> : '—'

  return (
    <section className="px-4 lg:px-0">
      <div className="mb-1 flex min-h-11 items-center gap-2 ps-1">
        {heading ? (
          <>
            <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">{heading.title}</h2>
            <span className="font-mono-numbers text-[0.8125rem] font-semibold text-[var(--color-brand-text-muted)]">{heading.count}</span>
          </>
        ) : (
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{lt.holdings}</h2>
        )}
        <Button variant="ghost" size="touch" onClick={onAdd} aria-label={t.addPocketOrAsset}
          className="ms-auto gap-1 px-1 text-[0.875rem] font-semibold text-[var(--color-brand-primary-ink)] hover:text-[var(--color-brand-primary-ink)] [&_svg:not([class*='size-'])]:size-4">
          <Plus aria-hidden />{heading?.addLabel ?? lt.add}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
      ) : (
        <Card padding="none" className="overflow-hidden rounded-2xl">
          {items.map((it, i) => {
            const sep = i > 0 ? <div aria-hidden className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null
            if (it.kind === 'group') {
              return (
                <div key="goal-pockets" data-expanded={open} onClick={() => setOpen((v) => !v)}>
                  {sep}
                  <TransactionRow
                    icon={<Target className="size-5" aria-hidden />}
                    iconBg={tint('var(--color-brand-primary)')}
                    iconFg="var(--color-brand-primary-ink)"
                    title={<span className="inline-flex items-center gap-1">{lt.goalPockets} · {members.length}<ChevronDown aria-hidden className={`size-4 text-[var(--color-brand-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} /></span>}
                    subtitle={members.map((m) => rowTitle(m, sf.systemNames, lt)).join(', ')}
                    amount={amountNode(groupTotal)}
                    onClick={() => undefined}
                  />
                </div>
              )
            }
            const r = it.row
            const { Icon, color } = CAT[r.cat]
            return (
              <div key={r.id} className={it.nested ? 'bg-[var(--color-brand-elevated)]/40' : undefined} onClick={(e) => onRowPress(r, e.currentTarget.getBoundingClientRect())}>
                {sep}
                <TransactionRow
                  icon={<Icon className="size-5" aria-hidden />}
                  iconBg={tint(color)}
                  iconFg={color}
                  title={rowTitle(r, sf.systemNames, lt)}
                  subtitle={subtitle(r, t, sf.identity, locale, goalLines?.[r.id], lt)}
                  amount={amountNode(r.amount)}
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
