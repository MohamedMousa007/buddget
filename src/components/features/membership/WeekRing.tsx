'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useWeekCheckStore } from '@/lib/loyalty/weekCheckStore'

const R = 8.5
const C = 2 * Math.PI * R
const GAP = 2.4

/** This week's records as a small 3-segment ring beside the tier in the profile menu (round 9); it opens Rewards. Hidden until the week is known. */
export function WeekRing({ onNavigate }: { onNavigate?: () => void }) {
  const c = useMembershipCopy().week
  const summary = useWeekCheckStore((s) => s.summary)
  if (!summary) return null
  const needed = Math.max(1, summary.recordsNeeded || 3)
  const done = Math.min(needed, summary.recordsThisWeek)
  const seg = C / needed
  return (
    <Link
      href="/settings/rewards"
      onClick={onNavigate}
      role="menuitem"
      aria-label={c.ringAria(done, needed)}
      className="pointer-events-auto relative z-10 -my-3 flex min-h-11 min-w-11 shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden className="-rotate-90">
        {Array.from({ length: needed }, (_, i) => (
          <circle
            key={i}
            cx="11"
            cy="11"
            r={R}
            fill="none"
            strokeWidth="3"
            style={{ stroke: i < done ? 'var(--color-brand-primary)' : 'var(--color-brand-border-strong)' }}
            strokeDasharray={`${seg - GAP} ${C - seg + GAP}`}
            strokeDashoffset={-(i * seg) - GAP / 2}
          />
        ))}
      </svg>
    </Link>
  )
}
