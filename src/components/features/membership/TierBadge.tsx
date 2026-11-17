import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TIER_BADGE, type TierGlyph, type TierKey } from './tiers'
import s from './membership.module.css'

const GLYPH: Record<TierGlyph, ReactNode> = {
  chevron: <path d="M8 13.5l4-3.5 4 3.5" fill="none" stroke="#1b2224" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />,
  gem: <path d="M8.5 10.5h7l-3.5 5.5z M8.5 10.5l1.6-2h3.8l1.6 2" fill="none" stroke="#062a1e" strokeWidth="1.3" strokeLinejoin="round" opacity=".8" />,
  diamond: <path d="M12 7.5l4 4.5-4 4.5-4-4.5z M8 12h8 M12 7.5v9" fill="none" stroke="#28406a" strokeWidth="1.2" strokeLinejoin="round" opacity=".7" />,
  crown: <path d="M7.5 15.5h9l.8-6-3 2.4L12 8l-2.3 3.9-3-2.4z" fill="#2b0207" opacity=".72" />,
  crownstar: (
    <>
      <path d="M7.5 15.5h9l.8-6-3 2.4L12 8l-2.3 3.9-3-2.4z" fill="#2a1d04" opacity=".72" />
      <circle cx="12" cy="13.4" r="1.1" fill="#39d79a" />
    </>
  ),
}

export interface TierBadgeProps {
  tier: TierKey
  /** Pixels, 16 to 34: 16 beside a name in a row, 20 on the card, 22 on a profile, 28 in a settings row, 34 on the ladder. */
  size?: number
  /** Accessible name ("Emerald tier"). Leave out where the tier is already named in text beside it. */
  label?: string
  className?: string
}

/** The tier's hexagon: metal gradient, a lit top facet, the tier glyph, and a bevel ring from Elite up. Follows a name everywhere a name shows. */
export function TierBadge({ tier, size = 28, label, className }: TierBadgeProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const t = TIER_BADGE[tier]
  return (
    <svg className={cn(s.tbadge, className)} width={size} height={size} viewBox="0 0 24 24" data-tier={tier} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          {t.metal.map((c, i) => <stop key={i} offset={i / (t.metal.length - 1)} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#000" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <path d="M12 2.6l7.8 4.5v9.8L12 21.4 4.2 16.9V7.1z" fill={`url(#${id}m)`} stroke="rgba(0,0,0,.35)" strokeWidth=".6" />
      <path d="M12 2.6l7.8 4.5L12 11.6 4.2 7.1z" fill="#fff" opacity=".18" />
      {t.ring ? <path d="M12 1.6l8.6 5v10.8L12 22.4 3.4 17.4V6.6z" fill="none" stroke={`url(#${id}e)`} strokeWidth="1.1" /> : null}
      {GLYPH[t.glyph]}
    </svg>
  )
}
