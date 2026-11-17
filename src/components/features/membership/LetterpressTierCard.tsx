import { useId, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardFace, FlipCardRig, LockPill } from './FlipCardRig'
import { CardTicks, Wordmark } from './cardParts'
import { tierPressVars, type TierKey } from './tiers'
import s from './cards.module.css'

/** Paper grain: fractal noise multiplied into the stock. */
function Paper() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg className={s.paper} aria-hidden>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  )
}

export interface LetterpressTierFrontProps {
  tier: TierKey
  /** The tier's name; set in capitals by the card. */
  tierName: string
  /** Lifetime points, already formatted ("1,240"). */
  points: string
  /** "pts". */
  pointsUnit: string
  name: string
  /** Progress to the next tier, 0 to 100 (see `tierProgressPct`). */
  progress: number
  /** "260 pts to Diamond" / "The top tier for Pro members" / "The highest tier there is". */
  nextLine: ReactNode
  /** "Tier 2 of 5". */
  rankLine: ReactNode
}

export function LetterpressTierFront({ tier, tierName, points, pointsUnit, name, progress, nextLine, rankLine }: LetterpressTierFrontProps) {
  return (
    <CardFace finish="letterpress" style={tierPressVars(tier)}>
      <Paper />
      <div className={s.emb} aria-hidden>b</div>
      <div className={s.cin}>
        <div className={s.chead}>
          <span dir="auto" className={cn(s.lptier, s.foil)}>{tierName}</span>
          <span dir="ltr" className={s.lppts}>{points}<small>{pointsUnit}</small></span>
        </div>
        <div>
          <div dir="auto" className={cn(s.lpname, s.foil)}>{name}</div>
          <div className={s.lpbar}><i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
          <div className={s.lpfoot}><span dir="auto">{nextLine}</span><span dir="auto">{rankLine}</span></div>
        </div>
      </div>
    </CardFace>
  )
}

export interface LetterpressTierBackProps {
  tier: TierKey
  /** "EMERALD PERKS". */
  title: string
  perks: readonly ReactNode[]
  /** "Member 0042" / "Founder #023" at the start, "Since Nov 2026" at the end. */
  footer: readonly [ReactNode, ReactNode]
}

export function LetterpressTierBack({ tier, title, perks, footer }: LetterpressTierBackProps) {
  return (
    <CardFace finish="letterpress" style={tierPressVars(tier)}>
      <Paper />
      <div className={s.cin}>
        <div className={s.chead}><span dir="auto" className={cn(s.lptier, s.foil)}>{title}</span><Wordmark /></div>
        <CardTicks items={perks} />
        <div>
          <div className={s.rule} />
          <div className={s.lpfoot}><span dir="auto">{footer[0]}</span><span dir="auto">{footer[1]}</span></div>
        </div>
      </div>
    </CardFace>
  )
}

export interface LetterpressTierCardProps {
  front: Omit<LetterpressTierFrontProps, 'tier'>
  back: Omit<LetterpressTierBackProps, 'tier'>
  tier: TierKey
  /** A Pro-only tier seen without Pro (see `isTierLocked`): the card greys and carries the pill. */
  locked?: boolean
  /** "Pro members only". Shown only when locked. */
  lockLabel?: string
  flipLabel: string
  onFlip?: (flipped: boolean) => void
  className?: string
}

/** The rewards card: letterpress stock in the tier's colour on the flip rig; the back lists the tier's perks. */
export function LetterpressTierCard({ front, back, tier, locked = false, lockLabel, flipLabel, onFlip, className }: LetterpressTierCardProps) {
  return (
    <FlipCardRig
      label={flipLabel}
      onFlip={onFlip}
      className={className}
      dimmed={locked}
      overlay={locked && lockLabel ? <LockPill><Lock aria-hidden />{lockLabel}</LockPill> : undefined}
      front={<LetterpressTierFront tier={tier} {...front} />}
      back={<LetterpressTierBack tier={tier} {...back} />}
    />
  )
}
