'use client'

import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatTile } from '@/components/ui/StatTile'
import { useActionToast } from '@/components/ui/ActionToast'
import { useLocale, useT } from '@/lib/i18n'
import { recapShareText, shareRecapImage } from '@/lib/insights/shareRecap'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useInsightsLtCopy } from '@/lib/i18n/insightsLtCopy'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import type { Recap } from '@/lib/insights/recap'
import { formatWhole } from '@/lib/utils/formatters'
import { DeltaChip, InsightsSection, LockedSection } from './InsightsParts'

interface Props {
  recap: Recap | null
  /** The recap cycle's name, for "September in one look". */
  month: string
  locked: boolean
  onUnlock: () => void
}

/** Recap cells: the compact KPI tile on the elevated fill, centred like the mockup. */
const CELL = 'border-transparent bg-[var(--color-brand-elevated)] text-center'

/** The last closed cycle in one look: spent (with the change on the cycle before), kept, and the biggest buy. Pro. */
export function RecapCards({ recap, month, locked, onUnlock }: Props) {
  const t = useT()
  const c = useInsightsLtCopy().recap
  const hidden = useMask('lists')
  const { locale } = useLocale()
  const toast = useActionToast()
  if (locked) {
    const teaser = (
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 rounded-xl bg-[var(--color-brand-elevated)]" />
        <div className="h-16 rounded-xl bg-[var(--color-brand-elevated)]" />
        <div className="h-16 rounded-xl bg-[var(--color-brand-elevated)]" />
      </div>
    )
    return <LockedSection title={c.title(month)} what={c.lockedWhat} teaser={teaser} onUnlock={onUnlock} />
  }
  if (!recap) return null
  const money = (n: number) => (hidden ? MASK : formatWhole(n))
  const delta = recap.spentBefore && recap.spentBefore > 0 ? Math.round(((recap.spent - recap.spentBefore) / recap.spentBefore) * 100) : null
  const kept = recap.received - recap.spent
  const keptShare = recap.received > 0 ? Math.round((Math.abs(kept) / recap.received) * 100) : null
  const share = async () => {
    const text = recapShareText(recap, t.insights.share, (raw) => categoryLabel(t, raw))
    if ((await shareRecapImage(text, locale === 'ar')) === 'downloaded') toast(t.expenses.fileSaved)
  }
  return (
    <InsightsSection title={c.title(month)}>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile compact className={CELL} label={c.spent} value={money(recap.spent)} sub={delta !== null ? <DeltaChip pct={delta} /> : undefined} />
        {keptShare !== null ? <StatTile compact className={CELL} label={kept >= 0 ? c.kept : c.over} value={hidden ? MASK : `${keptShare}%`} /> : null}
        {recap.biggest ? <StatTile compact className={CELL} label={c.biggest} value={`${recap.biggest.description} ${money(recap.biggest.amount)}`.trim()} /> : null}
      </div>
      <Button variant="ghost" size="touch" className="-mb-1.5 -ms-2 mt-1 gap-1.5 font-bold text-[var(--color-brand-primary-ink)]" onClick={share}>
        <Share2 aria-hidden className="size-4" />
        {t.insights.share.button}
      </Button>
    </InsightsSection>
  )
}
