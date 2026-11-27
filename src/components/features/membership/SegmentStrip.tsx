import { cn } from '@/lib/utils'

export type Segment = 'kept' | 'frozen' | 'now' | 'empty' | 'missed' | 'up'

const LOOK: Record<Segment, string> = {
  kept: 'bg-[linear-gradient(90deg,var(--color-brand-primary-hover),var(--member-mint))]',
  frozen: 'border border-[var(--color-cat-5,var(--color-brand-border-strong))] bg-[repeating-linear-gradient(135deg,var(--color-brand-border-strong)_0_3px,transparent_3px_6px)]',
  now: 'border-2 border-dashed border-[var(--color-brand-primary)]',
  empty: 'bg-[var(--color-brand-sunken)]',
  missed: 'bg-[var(--color-brand-sunken)]',
  up: 'bg-[var(--color-brand-sunken)]',
}

/** The streak bar on the Pro aurora (round 9): kept in the brand colour, this week outlined, missed neutral, upcoming faint. */
export const WEEK_LOOK: Record<Segment, string> = {
  kept: 'bg-[var(--color-brand-primary-bright)]',
  frozen: LOOK.frozen,
  now: 'border-2 border-[var(--member-fg)]',
  missed: 'bg-[color-mix(in_oklab,var(--member-fg)_42%,transparent)]',
  up: 'bg-[color-mix(in_oklab,var(--member-fg)_12%,transparent)]',
  empty: 'bg-[color-mix(in_oklab,var(--member-fg)_12%,transparent)]',
}

/**
 * A row of equal segments: the weekly streak and the 14-day progress. `onSurface` is for a segment strip on the Pro aurora;
 * `look="week"` is the round 9 streak colours (default unchanged).
 */
export function SegmentStrip({ segments, label, onSurface = false, look = 'default' }: { segments: Segment[]; label: string; onSurface?: boolean; look?: 'default' | 'week' }) {
  const week = look === 'week'
  return (
    <div role="img" aria-label={label} dir="ltr" className="flex gap-[5px]">
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            'h-2 flex-1 rounded-full',
            week ? WEEK_LOOK[s] : LOOK[s],
            !week && onSurface && s === 'empty' && 'bg-[var(--member-cell)]',
            !week && onSurface && s === 'now' && 'border-white/85',
          )}
        />
      ))}
    </div>
  )
}
