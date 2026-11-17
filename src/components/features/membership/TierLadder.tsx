import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TierBadge } from './TierBadge'
import { isProOnlyTier, ladderRowState, type TierKey } from './tiers'
import s from './membership.module.css'

export interface TierLadderRow {
  tier: TierKey
  name: string
  description: ReactNode
  /** The points it takes, formatted ("1,500"), or a word ("Founder"). */
  threshold: string
}

export interface TierLadderProps {
  /** Rows in rank order, Silver first. */
  rows: readonly TierLadderRow[]
  current: TierKey
  /** The chip on Pro-only tiers: "PRO". */
  proLabel: string
  /** Appended to the current tier's name: "you're here". */
  hereLabel: string
  className?: string
}

/** The tier ladder: each tier with its badge, what it brings and what it takes; the member's own row is washed in gold. */
export function TierLadder({ rows, current, proLabel, hereLabel, className }: TierLadderProps) {
  return (
    <div className={cn(s.panel, s.ladder, className)}>
      {rows.map((r) => {
        const state = ladderRowState(r.tier, current)
        return (
          <div key={r.tier} className={cn(s.lrow, state === 'current' && s.lrowCur)} data-state={state} aria-current={state === 'current' ? 'true' : undefined}>
            <span className={s.lic}><TierBadge tier={r.tier} size={34} /></span>
            <div>
              <h4 dir="auto">
                {r.name}
                {isProOnlyTier(r.tier) ? <span className={s.lpro}>{proLabel}</span> : null}
                {state === 'current' ? ` · ${hereLabel}` : null}
              </h4>
              <p dir="auto">{r.description}</p>
            </div>
            <em dir="auto">{r.threshold}</em>
          </div>
        )
      })}
    </div>
  )
}
