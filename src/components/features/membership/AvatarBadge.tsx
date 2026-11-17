import type { ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TierBadge } from './TierBadge'
import type { TierKey } from './tiers'
import s from './membership.module.css'

export interface AvatarBadgeProps {
  /** Initials, or an <img> that fills the circle. */
  children: ReactNode
  /** 64px on the profile head, 46px in the badge preview, 40px in rows. */
  size?: 'lg' | 'md' | 'sm'
  /** The gold tag's text ("PRO"). Present for Pro and trial members only. */
  proTag?: string
  /** Founders: the gold and emerald ring. */
  founder?: boolean
  /** Pins the tier badge to the avatar's corner (the Rewards "Profile" preview). Elsewhere the badge follows the name instead. */
  cornerTier?: TierKey
  cornerTierLabel?: string
  className?: string
}

/** The avatar with its membership marks: gold PRO tag for Pro and trial, the founder's ring. */
export function AvatarBadge({ children, size = 'lg', proTag, founder, cornerTier, cornerTierLabel, className }: AvatarBadgeProps) {
  return (
    <span className={cn(s.ava, size === 'sm' && s.avaSm, size === 'md' && s.avaMd, founder && s.avaFounder, className)} data-founder={founder || undefined}>
      <span className={s.avaIn}>{children}</span>
      {proTag ? <span className={s.protag}>{proTag}</span> : null}
      {cornerTier ? <TierBadge tier={cornerTier} size={22} label={cornerTierLabel} className={s.avaCorner} /> : null}
    </span>
  )
}

/** The numbered gold chip only a founder carries, after the tier badge: "#023". */
export function FounderChip({ number, className }: { number: string; className?: string }) {
  return (
    <span dir="ltr" className={cn(s.fchip, className)}>
      <Crown aria-hidden />
      {number}
    </span>
  )
}
