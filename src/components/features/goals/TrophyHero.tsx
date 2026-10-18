import { Trophy } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface TrophyStats {
  count: number
  totalLabel: string
  avgMonths: number
  early: number
  checkpoints: number
}

/** Brand-teal trophy room hero: count, total saved, three stat tiles. */
export function TrophyHero({ stats }: { stats: TrophyStats }) {
  const t = useT().goals.achievedView
  const tiles: [string, number][] = [
    [t.statMonths, stats.avgMonths],
    [t.statEarly, stats.early],
    [t.statCheckpoints, stats.checkpoints],
  ]
  return (
    <section className="flex flex-col items-center gap-3 rounded-3xl bg-[var(--color-brand-primary)] px-[18px] pb-[18px] pt-[22px] text-center text-[var(--color-brand-on-primary)]">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-[var(--color-brand-on-primary)] ring-8 ring-[var(--color-brand-on-primary)]/20">
        <Trophy className="size-9 text-[var(--color-brand-primary)]" aria-hidden />
      </span>
      <p className="flex items-baseline gap-2">
        <span className="font-mono-numbers text-[56px] font-bold leading-none tracking-[-0.03em]">{stats.count}</span>
        <span className="text-lg font-bold">{t.goalsAchieved}</span>
      </p>
      <p className="max-w-[280px] text-sm">{t.line(stats.totalLabel)}</p>
      <div className="grid w-full grid-cols-3 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-[14px] bg-[var(--color-brand-on-primary)]/15 px-2 py-2.5">
            <p className="font-mono-numbers text-xl font-bold">{value}</p>
            <p className="mt-0.5 text-[11px] font-semibold opacity-90">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
