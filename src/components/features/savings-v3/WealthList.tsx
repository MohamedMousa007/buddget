'use client'

import { Banknote, Bitcoin, FileText, Gem, House, Landmark, Plus, TrendingUp, Vault, Wallet, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { pocketDisplayName, pocketIdentity } from '@/lib/savings/pocketIdentity'
import type { CatKey, WealthRowVM } from '@/lib/savings/wealthModel'
import { useLocale, useT } from '@/lib/i18n'
import { formatClock, formatLocalized, type AppLocale } from '@/lib/i18n/dateFormat'
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
  categories: { key: CatKey; count: number }[]
  filter: CatKey | null
  onFilter: (k: CatKey | null) => void
  /** The row's rect anchors its action menu. */
  onRowPress: (row: WealthRowVM, anchor: DOMRect) => void
  onAdd: () => void
  /** Pocket id → "Feeds New car · 62%". */
  goalLines?: Record<string, string>
}

function subtitle(row: WealthRowVM, t: ReturnType<typeof useT>['wealthPage'], identity: ReturnType<typeof useT>['savingsForms']['identity'], locale: AppLocale, goal?: string): string {
  if (row.account) return [pocketIdentity(row.account, identity, locale), goal].filter(Boolean).join(' · ')
  const h = row.holding!
  const unit = h.assetType === 'gold' ? ' g' : h.assetType === 'property' ? ' m²' : ''
  if (row.unitPrice == null) {
    return h.assetType === 'property'
      ? `${formatQuantity(h.quantity, h.assetType)}${unit}`
      : `${formatQuantity(h.quantity, h.assetType)}${unit} · ${t.notPriced}${row.asOf ? ` · ${formatLocalized(new Date(row.asOf), 'd MMM', locale)}` : ''}`
  }
  return h.assetType === 'property' ? `${formatQuantity(h.quantity, h.assetType)}${unit}` : `${formatQuantity(h.quantity, h.assetType)}${unit} × ${formatWhole(row.unitPrice)}`
}

/** Every balance and position in one list, with a filter by kind. The one Add button lives here. */
export function WealthList({ rows, categories, filter, onFilter, onRowPress, onAdd, goalLines }: WealthListProps) {
  const t = useT().wealthPage
  const sf = useT().savingsForms
  const { locale } = useLocale()
  const shown = filter ? rows.filter((r) => r.cat === filter) : rows
  const groups = filter
    ? [{ key: 'all', title: null as string | null, rows: shown }]
    : [
        { key: 'pockets', title: t.groupPockets, rows: shown.filter((r) => r.pricing === 'balance') },
        { key: 'inv', title: t.groupInvestments, rows: shown.filter((r) => r.pricing !== 'balance') },
      ].filter((g) => g.rows.length > 0)
  const showHeaders = !filter && groups.length > 1

  return (
    <section>
      <div className="flex items-center gap-2 px-4 lg:px-0">
        <h2 className="text-[17px] font-bold text-[var(--color-brand-text-primary)]">{t.whereItIs}</h2>
        <Badge variant="muted" className="min-w-[21px] px-1.5 font-mono-numbers text-[0.6875rem] font-semibold">{rows.length}</Badge>
        <Button variant="secondary" size="touch" className="ms-auto" onClick={onAdd}>
          <Plus /> {t.addPocketOrAsset}
        </Button>
      </div>

      {categories.length > 1 ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 lg:px-0">
          <OptionChip surface="card" selected={filter === null} onClick={() => onFilter(null)}>
            {t.all}
            <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{rows.length}</span>
          </OptionChip>
          {categories.map(({ key, count }) => {
            const { Icon, color } = CAT[key]
            return (
              <OptionChip key={key} surface="card" selected={filter === key} onClick={() => onFilter(filter === key ? null : key)}>
                <Icon style={{ color }} aria-hidden />
                {t.catLabels[key]}
                <span className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{count}</span>
              </OptionChip>
            )
          })}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--color-brand-text-muted)]">{t.nothingHeld}</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="mt-3">
            {showHeaders ? (
              <div className="flex items-center justify-between px-4 pb-2 text-[0.6875rem] lg:px-0 font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
                <span>{g.title}</span>
                <span className="font-mono-numbers">{formatWhole(g.rows.reduce((s, r) => s + (r.amount ?? 0), 0))}</span>
              </div>
            ) : null}
            <div className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)] lg:overflow-hidden lg:rounded-2xl lg:border-x">
              {g.rows.map((r, i) => {
                const { Icon, color } = CAT[r.cat]
                return (
                  <div
                    key={r.id}
                    className={i > 0 ? 'border-t border-[var(--color-brand-border)]' : undefined}
                    onClick={(e) => onRowPress(r, e.currentTarget.getBoundingClientRect())}
                  >
                    <TransactionRow
                      icon={<Icon className="size-5" aria-hidden />}
                      iconBg={tint(color)}
                      iconFg={color}
                      title={r.account ? pocketDisplayName(r.account, sf.systemNames) : r.title}
                      subtitle={subtitle(r, t, sf.identity, locale, goalLines?.[r.id])}
                      amount={r.amount != null ? formatWhole(r.amount) : '—'}
                      sub={r.asOf && r.source === 'holding' && r.pricing === 'market' ? formatClock(new Date(r.asOf), locale) : undefined}
                      onClick={() => undefined}
                      dimmed={r.amount == null}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
