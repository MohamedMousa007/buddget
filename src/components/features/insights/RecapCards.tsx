'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import type { Recap } from '@/lib/insights/recap'
import { formatCurrency } from '@/lib/utils/formatters'
import type { Currency } from '@/lib/store/types'

interface Props {
  recap: Recap | null
  currency: Currency
  locked: boolean
  onUnlock: () => void
}

function Slide({ label, big, line }: { label: string; big: string; line: string }) {
  return (
    <Card padding="md" className="min-w-[15rem] shrink-0 snap-center space-y-1">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-text-secondary)]">{label}</span>
      <b className="block break-words font-mono-numbers text-2xl font-extrabold leading-tight text-[var(--color-brand-primary-ink)]">{big}</b>
      <p className="text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">{line}</p>
    </Card>
  )
}

/** The last closed cycle as five swipeable cards. Free sees one locked card in their place. */
export function RecapCards({ recap, currency, locked, onUnlock }: Props) {
  const t = useT()
  const c = t.insights.recap
  const hidden = useMask('lists')
  if (!recap) return <p className="px-1 text-[0.78125rem] text-[var(--color-brand-text-muted)]">{c.none}</p>
  if (locked) {
    return (
      <Card padding="md" className="space-y-1">
        <p className="text-sm font-bold text-[var(--color-brand-text-primary)]">{c.locked}</p>
        <Button variant="ghost" size="touch" className="-mb-1.5 -ms-2 font-bold text-[var(--color-brand-gold)]" onClick={onUnlock}>
          {t.insights.unlock} ›
        </Button>
      </Card>
    )
  }
  const money = (n: number) => (hidden ? MASK : formatCurrency(n, currency, false))
  const delta = recap.spentBefore && recap.spentBefore > 0 ? Math.round(((recap.spent - recap.spentBefore) / recap.spentBefore) * 100) : null
  const kept = recap.received - recap.spent
  const keptShare = recap.received > 0 ? Math.round((Math.abs(kept) / recap.received) * 100) : 0
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 hide-scrollbar">
      <Slide label={c.spent.label} big={money(recap.spent)} line={c.spent.line(delta === null ? null : Math.abs(delta), (delta ?? 0) > 0)} />
      {recap.topCategory && <Slide label={c.top.label} big={money(recap.topCategory.amount)} line={c.top.line(categoryLabel(t, recap.topCategory.name))} />}
      {recap.biggest && <Slide label={c.biggest.label} big={money(recap.biggest.amount)} line={c.biggest.line(recap.biggest.description)} />}
      {recap.received > 0 && <Slide label={c.kept.label(kept >= 0)} big={money(Math.abs(kept))} line={c.kept.line(keptShare)} />}
      <Slide label={c.count.label} big={String(recap.purchases)} line={c.count.line((recap.purchases / recap.days).toFixed(1))} />
    </div>
  )
}
