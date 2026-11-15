import { cn } from '@/lib/utils'

export type Segment = 'kept' | 'frozen' | 'now' | 'empty'

const LOOK: Record<Segment, string> = {
  kept: 'bg-[linear-gradient(90deg,var(--color-brand-primary-hover),var(--member-mint))]',
  frozen: 'border border-[var(--color-cat-5,var(--color-brand-border-strong))] bg-[repeating-linear-gradient(135deg,var(--color-brand-border-strong)_0_3px,transparent_3px_6px)]',
  now: 'border-2 border-dashed border-[var(--color-brand-primary)]',
  empty: 'bg-[var(--color-brand-sunken)]',
}

/** A row of equal segments: the weekly streak and the 14-day progress. `onSurface` is for a segment strip on the Pro aurora. */
export function SegmentStrip({ segments, label, onSurface = false }: { segments: Segment[]; label: string; onSurface?: boolean }) {
  return (
    <div role="img" aria-label={label} dir="ltr" className="flex gap-[5px]">
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn('h-2 flex-1 rounded-full', LOOK[s], onSurface && s === 'empty' && 'bg-[var(--member-cell)]', onSurface && s === 'now' && 'border-white/85')}
        />
      ))}
    </div>
  )
}
