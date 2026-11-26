import { Trophy } from 'lucide-react'
import { BAND_FG2, HeroBand } from '@/components/features/hero/HeroBand'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'

export interface TrophyStats {
  count: number
  /** The total saved for them, formatted without the currency. */
  totalLabel: string
  currency: string
  deposits: number
  fastestMonths: number
  bestStreak: number
}

/** The trophy room hero on HeroBand: goals achieved, the total saved for them, three facts. */
export function TrophyHero({ stats }: { stats: TrophyStats }) {
  const c = useGoalsLtCopy().goals
  const hidden = useMask('hero')
  return (
    <HeroBand
      contained
      label={c.achievedLabel}
      aside={<Trophy className="size-[18px] text-[var(--flow-band-fg)]" aria-hidden />}
      numbers={
        <>
          <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{stats.count}</span>
          <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
            <b className="block font-mono-numbers text-[1.0625rem] text-[var(--flow-band-fg)]">{hidden ? MASK : stats.totalLabel}</b>
            {c.savedForThem(stats.currency)}
          </p>
        </>
      }
      cells={[
        { label: c.factDeposits, value: String(stats.deposits) },
        { label: c.factFastest, value: c.months(stats.fastestMonths) },
        { label: c.factStreak, value: c.months(stats.bestStreak) },
      ]}
    />
  )
}
