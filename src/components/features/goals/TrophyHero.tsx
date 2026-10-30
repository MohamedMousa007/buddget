import { Trophy } from 'lucide-react'
import { HeroBand } from '@/components/features/hero/HeroBand'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useT } from '@/lib/i18n'

export interface TrophyStats {
  count: number
  totalLabel: string
  avgMonths: number
  early: number
  checkpoints: number
}

/** The trophy room hero on HeroBand: goals achieved, total saved, three facts. */
export function TrophyHero({ stats }: { stats: TrophyStats }) {
  const t = useT().goals.achievedView
  const hidden = useMask('hero')
  return (
    <HeroBand
      contained
      label={t.goalsAchieved}
      aside={<Trophy className="size-[18px] text-[var(--flow-band-fg)]" aria-hidden />}
      numbers={<span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{stats.count}</span>}
      note={t.line(hidden ? MASK : stats.totalLabel)}
      cells={[
        { label: t.statMonths, value: String(stats.avgMonths) },
        { label: t.statEarly, value: String(stats.early) },
        { label: t.statCheckpoints, value: String(stats.checkpoints) },
      ]}
    />
  )
}
